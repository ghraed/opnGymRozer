import { syncSubscriptionRevenue } from './subscription-revenue.js'
import crypto from 'node:crypto'
import { financeToday, publicSubscription } from './subscriptions.js'
import { validDate } from './subscription-periods.js'
import { parseJson } from './state.js'

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }) }
const dateText = value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
export const DEFAULT_REMINDER_SETTINGS = { enabled: false, renewalLeadDays: 7, paymentLeadDays: 3, repeatDays: 7 }
export const dayDistance = (date, today) => Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000)
export async function reminderSettings(pool) {
  const [rows] = await pool.execute("SELECT value_json FROM app_settings WHERE setting_key='membership_reminders'")
  return { ...DEFAULT_REMINDER_SETTINGS, ...(rows.length ? parseJson(rows[0].value_json) : {}) }
}
export async function saveReminderSettings(pool, actor, body) {
  if (!body || typeof body.enabled !== 'boolean') fail('enabled must be true or false')
  for (const [key, min, max] of [['renewalLeadDays', 0, 60], ['paymentLeadDays', 0, 60], ['repeatDays', 1, 30]]) if (!Number.isInteger(body[key]) || body[key] < min || body[key] > max) fail(`${key} must be ${min}–${max} whole days`)
  const settings = Object.fromEntries(Object.keys(DEFAULT_REMINDER_SETTINGS).map(key => [key, body[key]]))
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction(); await adminLock(conn, actor)
    await conn.execute("INSERT INTO app_settings(setting_key,value_json) VALUES ('membership_reminders',?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)", [JSON.stringify(settings)])
    await conn.commit(); return settings
  } catch (error) { await conn.rollback(); throw error } finally { conn.release() }
}
async function adminLock(conn, actor) {
  const [rows] = await conn.execute('SELECT role,disabled FROM users WHERE id=? FOR UPDATE', [actor.id])
  if (!rows[0] || rows[0].role !== 'admin' || rows[0].disabled) fail('admin access required', 403)
}
export async function reviewPayment(pool, actor, body) {
  if (!body || typeof body.id !== 'string' || !body.id || !Number.isInteger(body.version) || body.version < 1) fail('subscription id and current version required')
  if (!['unconfirmed', 'unpaid', 'paid', 'waived'].includes(body.paymentStatus)) fail('invalid payment status')
  if (typeof body.note !== 'string' || !body.note.trim() || body.note.trim().length > 500) fail('a payment review note of 1–500 characters is required')
  if (body.paymentStatus === 'unpaid' && !validDate(body.dueOn)) fail('a valid payment due date is required')
  if (body.paymentStatus === 'paid' && body.receivedOn !== undefined && !validDate(body.receivedOn)) fail('a valid received date is required')
  if (body.paymentStatus === 'paid' && body.paymentMethod !== undefined && !['cash','card','transfer','other'].includes(body.paymentMethod)) fail('invalid payment method')
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction(); await adminLock(conn, actor)
    const [[row]] = await conn.execute('SELECT * FROM member_subscriptions WHERE id=? FOR UPDATE', [body.id])
    if (!row) fail('subscription not found', 404)
    if (Number(row.version) !== body.version) fail('This subscription changed. Reload before reviewing payment.', 409)
    if (row.cancelled_at && body.paymentStatus === 'unpaid') fail('Cancelled subscriptions cannot receive payment reminders', 409)
    if (body.paymentStatus === 'unpaid' && Number(row.price) === 0) fail('Free subscriptions have no payment due')
    await syncSubscriptionRevenue(conn, row, actor.id, body.paymentStatus, body.receivedOn || financeToday(), body.paymentMethod || 'other', body.note.trim())
    const dueOn = body.paymentStatus === 'unpaid' ? body.dueOn : null
    await conn.execute('UPDATE member_subscriptions SET payment_status=?,payment_due_on=?,payment_updated_at=CURRENT_TIMESTAMP(3),payment_updated_by=?,version=version+1 WHERE id=?', [body.paymentStatus, dueOn, actor.id, row.id])
    await conn.execute('INSERT INTO subscription_payment_events(subscription_id,previous_status,payment_status,due_on,note,actor_id) VALUES (?,?,?,?,?,?)', [row.id, row.payment_status, body.paymentStatus, dueOn, body.note.trim(), actor.id])
    if (body.paymentStatus !== 'unpaid') await conn.execute("UPDATE subscription_reminders SET delivery='skipped',detail='Payment no longer due' WHERE subscription_id=? AND kind='payment' AND delivery IN ('pending','failed')", [row.id])
    await conn.commit(); return { ok: true }
  } catch (error) { await conn.rollback(); throw error } finally { conn.release() }
}

const reminderSelect = `SELECT s.*,u.name current_member_name,u.email member_email,u.disabled member_disabled,u.role member_role,
  EXISTS(SELECT 1 FROM push_subscriptions p WHERE p.user_id=s.member_id) has_push,
  (SELECT n.id FROM member_subscriptions n WHERE n.member_id=s.member_id AND n.id<>s.id AND n.cancelled_at IS NULL AND n.starts_on>=s.ends_on ORDER BY n.starts_on LIMIT 1) next_term_id
  FROM member_subscriptions s LEFT JOIN users u ON u.id=s.member_id`
function reminderContext(row, today) {
  return { ...publicSubscription(row, today), nextTermId: row.next_term_id || null,
    canRemind: row.member_role === 'client' && !row.member_disabled, hasPush: !!row.has_push }
}
async function contextFor(pool, id) {
  const [[row]] = await pool.execute(reminderSelect + ' WHERE s.id=?', [id])
  return row ? reminderContext(row, financeToday()) : null
}
export async function renewalTracker(pool) {
  const settings = await reminderSettings(pool), today = financeToday()
  const [rows] = await pool.query(reminderSelect + ' ORDER BY s.ends_on,s.id')
  const subscriptions = rows.map(row => {
    const subscription = reminderContext(row, today), daysLeft = dayDistance(subscription.endsOn, today)
    return { ...subscription, daysLeft,
      renewalStatus: subscription.status === 'cancelled' ? 'cancelled' : subscription.nextTermId ? 'renewed' : daysLeft <= 0 ? 'overdue' : daysLeft <= settings.renewalLeadDays ? 'due_soon' : 'current',
      paymentOverdue: subscription.paymentStatus === 'unpaid' && subscription.paymentDueOn < today }
  })
  const [history] = await pool.query('SELECT r.*,s.member_name,s.plan_name FROM subscription_reminders r JOIN member_subscriptions s ON s.id=r.subscription_id ORDER BY r.created_at DESC,r.id DESC LIMIT 100')
  const [events] = await pool.query('SELECT e.*,u.name actor_name FROM subscription_payment_events e LEFT JOIN users u ON u.id=e.actor_id ORDER BY e.id DESC LIMIT 100')
  return { asOf: today, subscriptions, settings, history: history.map(r => ({ id: r.id, subscriptionId: r.subscription_id, memberName: r.member_name, kind: r.kind, source: r.source, date: dateText(r.reminder_date), delivery: r.delivery, attempts: r.attempts, detail: r.detail })),
    paymentEvents: events.map(e => ({ subscriptionId: e.subscription_id, from: e.previous_status, to: e.payment_status, dueOn: e.due_on ? dateText(e.due_on) : null, note: e.note, actor: e.actor_name || 'Deleted admin', createdAt: e.created_at })) }
}
export function reminderEligible(subscription, kind) {
  if (!subscription.canRemind || subscription.status === 'cancelled') return false
  return kind === 'payment' ? subscription.paymentStatus === 'unpaid' && !!subscription.paymentDueOn && Number(subscription.price) > 0 : kind === 'renewal' && !subscription.nextTermId
}

export async function queueReminder(pool, actor, body, source = 'manual') {
  if (!body || typeof body.id !== 'string' || !['renewal', 'payment'].includes(body.kind)) fail('subscription id and reminder kind required')
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    if (actor) await adminLock(conn, actor)
    const subscription = await contextFor(conn, body.id)
    if (!subscription) fail('subscription not found', 404)
    if (!reminderEligible(subscription, body.kind)) fail('This subscription is not eligible for this reminder', 409)
    const id = crypto.randomBytes(12).toString('base64url')
    await conn.execute('INSERT INTO subscription_reminders(id,subscription_id,kind,reminder_date,source,created_by) VALUES (?,?,?,?,?,?)', [id, subscription.id, body.kind, financeToday(), source, actor?.id || null])
    await conn.commit(); return id
  } catch (error) {
    await conn.rollback()
    if (error.code === 'ER_DUP_ENTRY') fail('A reminder of this type is already recorded for today', 409)
    throw error
  } finally { conn.release() }
}

export async function scheduleMembershipReminders(pool) {
  const data = await renewalTracker(pool)
  if (!data.settings.enabled) return 0
  let queued = 0
  for (const subscription of data.subscriptions) for (const kind of ['renewal', 'payment']) {
    if (!reminderEligible(subscription, kind)) continue
    const days = kind === 'renewal' ? subscription.daysLeft : dayDistance(subscription.paymentDueOn, data.asOf)
    if (days > (kind === 'renewal' ? data.settings.renewalLeadDays : data.settings.paymentLeadDays)) continue
    // Query all history for cooldown correctness; the tracker intentionally shows only the latest 100 entries.
    const [[last]] = await pool.execute('SELECT MAX(reminder_date) latest FROM subscription_reminders WHERE subscription_id=? AND kind=? AND delivery<>\'skipped\'', [subscription.id, kind])
    if (last.latest && dayDistance(data.asOf, dateText(last.latest)) < data.settings.repeatDays) continue
    try { await queueReminder(pool, null, { id: subscription.id, kind }, 'automatic'); queued++ } catch (error) { if (error.status !== 409) throw error }
  }
  return queued
}
export function reminderMessage(subscription, kind) {
  return kind === 'payment'
    ? { title: 'Membership payment reminder', body: `${subscription.planName}: ${subscription.currency} ${subscription.price} is due on ${subscription.paymentDueOn}. Please contact your gym about payment.` }
    : { title: 'Membership renewal reminder', body: `${subscription.planName} coverage ends on ${subscription.endsOn}. Please contact your gym to arrange your next term.` }
}

// Durable claims prevent multiple API instances from sending the same job at once.
// Failed pushes retry at most 3 times, 15 minutes apart. In-app notices persist even without push.
export async function dispatchMembershipReminders(pool, sendPush, onlyId = null) {
  await pool.query("UPDATE subscription_reminders SET delivery='failed',detail='Delivery worker stopped after final attempt',lease_until=NULL WHERE delivery='processing' AND attempts>=3 AND lease_until<CURRENT_TIMESTAMP(3)")
  const [jobs] = await pool.execute(`SELECT id FROM subscription_reminders WHERE ${onlyId ? 'id=? AND ' : ''}attempts<3 AND
    ((delivery IN ('pending','failed') AND (next_attempt_at IS NULL OR next_attempt_at<=CURRENT_TIMESTAMP(3))) OR
    (delivery='processing' AND lease_until<CURRENT_TIMESTAMP(3))) ORDER BY created_at LIMIT 20`, onlyId ? [onlyId] : [])
  for (const job of jobs) {
    const token = crypto.randomBytes(12).toString('base64url')
    const [claim] = await pool.execute(`UPDATE subscription_reminders SET delivery='processing',lease_token=?,lease_until=DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 5 MINUTE),attempts=attempts+1
      WHERE id=? AND attempts<3 AND ((delivery IN ('pending','failed') AND (next_attempt_at IS NULL OR next_attempt_at<=CURRENT_TIMESTAMP(3))) OR (delivery='processing' AND lease_until<CURRENT_TIMESTAMP(3)))`, [token, job.id])
    if (!claim.affectedRows) continue
    try {
      const [[row]] = await pool.execute('SELECT * FROM subscription_reminders WHERE id=?', [job.id])
      const subscription = await contextFor(pool, row.subscription_id)
      const settings = await reminderSettings(pool)
      let delivery = 'skipped', detail = 'No longer applicable'
      if (subscription && reminderEligible(subscription, row.kind) && (row.source === 'manual' || settings.enabled)) {
        const message = reminderMessage(subscription, row.kind)
        if (!subscription.hasPush) { delivery = 'in_app'; detail = 'Available in app; push is not enabled' }
        else if (await sendPush(subscription.memberId, { title: message.title, body: 'Open ROZER to review your membership reminder.', tag: 'membership-' + row.kind + '-' + subscription.id })) { delivery = 'push_sent'; detail = 'Push service accepted; device delivery is asynchronous' }
        else { delivery = 'failed'; detail = 'Push was not accepted; reminder remains available in app' }
      }
      await pool.execute("UPDATE subscription_reminders SET delivery=?,detail=?,lease_until=NULL,next_attempt_at=IF(?='failed',DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 15 MINUTE),NULL) WHERE id=? AND lease_token=?", [delivery, detail, delivery, job.id, token])
    } catch (error) {
      await pool.execute("UPDATE subscription_reminders SET delivery='failed',detail='Temporary delivery failure',lease_until=NULL,next_attempt_at=DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 15 MINUTE) WHERE id=? AND lease_token=?", [job.id, token])
    }
  }
}
export async function memberReminders(pool, memberId) {
  const [own] = await pool.execute(reminderSelect + ' WHERE s.member_id=?', [memberId])
  const subscriptions = new Map(own.map(row => { const subscription = reminderContext(row, financeToday()); return [subscription.id, subscription] }))
  const [rows] = await pool.execute(`SELECT r.* FROM subscription_reminders r JOIN member_subscriptions s ON s.id=r.subscription_id
    WHERE s.member_id=? AND s.cancelled_at IS NULL AND r.read_at IS NULL AND r.delivery<>'skipped' AND
    ((r.kind='payment' AND s.payment_status='unpaid' AND s.payment_due_on IS NOT NULL AND s.price>0) OR
    (r.kind='renewal' AND NOT EXISTS(SELECT 1 FROM member_subscriptions n WHERE n.member_id=s.member_id AND n.id<>s.id AND n.cancelled_at IS NULL AND n.starts_on>=s.ends_on)))
    ORDER BY r.created_at DESC,r.id LIMIT 10`, [memberId])
  return rows.filter(row => subscriptions.has(row.subscription_id) && reminderEligible(subscriptions.get(row.subscription_id), row.kind)).map(row => ({ id: row.id, ...reminderMessage(subscriptions.get(row.subscription_id), row.kind) }))
}
