import crypto from 'node:crypto'
import { SUBSCRIPTION_CYCLES, subscriptionEnd, subscriptionStatus, planCycle } from './subscription-periods.js'

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }) }
const objectBody = body => { if (!body || typeof body !== 'object' || Array.isArray(body)) fail('subscription fields required') }
const dateText = value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
export const FINANCE_TIMEZONE = process.env.FINANCE_TIMEZONE || 'Asia/Beirut'
const clock = new Intl.DateTimeFormat('en-CA', { timeZone: FINANCE_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
export function financeToday(now = new Date()) {
  const parts = Object.fromEntries(clock.formatToParts(now).map(p => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function subscriptionInput(body) {
  objectBody(body)
  for (const key of ['memberId', 'planId', 'requestKey']) if (typeof body[key] !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(body[key])) fail(key + ' required')
  if (body.requestKey.length < 16) fail('requestKey must contain at least 16 characters')
  if (!Number.isInteger(body.planVersion) || body.planVersion < 1) fail('current plan version required')
  let endsOn
  try { endsOn = subscriptionEnd(body.startsOn, body.cycle) } catch (error) { fail(error.message) }
  if (body.notes != null && (typeof body.notes !== 'string' || body.notes.trim().length > 1000)) fail('notes must be at most 1000 characters')
  return { memberId: body.memberId, planId: body.planId, planVersion: body.planVersion, cycle: body.cycle,
    startsOn: body.startsOn, endsOn, notes: (body.notes || '').trim(), requestKey: body.requestKey }
}

const selectSubscriptions = `SELECT s.*,u.name current_member_name,u.email member_email FROM member_subscriptions s LEFT JOIN users u ON u.id=s.member_id`
const publicSubscription = (row, today) => {
  const subscription = { id: row.id, memberId: row.member_id, memberName: row.current_member_name || row.member_name,
    memberEmail: row.member_email || null, planId: row.plan_id, planName: row.plan_name,
    cycle: row.cycle, startsOn: dateText(row.starts_on), endsOn: dateText(row.ends_on), price: String(row.price), currency: row.currency,
    notes: row.notes, version: Number(row.version), cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason, createdAt: row.created_at }
  return { ...subscription, status: subscriptionStatus(subscription, today) }
}
export async function listSubscriptions(pool) {
  const today = financeToday()
  const [rows] = await pool.query(selectSubscriptions + ' ORDER BY s.starts_on DESC,s.created_at DESC,s.id')
  return { subscriptions: rows.map(row => publicSubscription(row, today)), asOf: today, timezone: FINANCE_TIMEZONE, cycles: Object.entries(SUBSCRIPTION_CYCLES).map(([id, cycle]) => ({ id, ...cycle })) }
}
export async function financeOverview(pool) {
  const today = financeToday()
  const [[plans]] = await pool.query('SELECT COUNT(*) activePlans FROM membership_plans WHERE active=TRUE')
  const [[counts]] = await pool.execute(`SELECT
    COALESCE(SUM(cancelled_at IS NULL AND starts_on<=? AND ends_on>?),0) activeSubscriptions,
    COALESCE(SUM(cancelled_at IS NULL AND starts_on>?),0) scheduledSubscriptions,
    COALESCE(SUM(cancelled_at IS NULL AND ends_on<=?),0) expiredSubscriptions,
    COALESCE(SUM(cancelled_at IS NOT NULL),0) cancelledSubscriptions FROM member_subscriptions`, [today, today, today, today])
  return { ...Object.fromEntries(Object.entries({ ...plans, ...counts }).map(([key, value]) => [key, Number(value)])), asOf: today, timezone: FINANCE_TIMEZONE }
}

async function authorizeAndLock(conn, actor, memberId) {
  const [users] = await conn.execute('SELECT id,role,disabled,name FROM users WHERE id IN (?,?) ORDER BY id FOR UPDATE', [actor.id, memberId || actor.id])
  const storedActor = users.find(u => u.id === actor.id)
  if (!storedActor || storedActor.role !== 'admin' || storedActor.disabled) fail('admin access required', 403)
  return users.find(u => u.id === memberId)
}
export async function createSubscription(pool, actor, body) {
  const input = subscriptionInput(body)
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex')
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const member = await authorizeAndLock(conn, actor, input.memberId)
    const [previous] = await conn.execute(selectSubscriptions + ' WHERE s.request_key=?', [input.requestKey])
    if (previous.length) {
      if (previous[0].request_hash !== requestHash || previous[0].created_by !== actor.id) fail('This request key was used for a different subscription', 409)
      await conn.commit()
      return { subscription: publicSubscription(previous[0], financeToday()), replayed: true }
    }
    if (!member || member.role !== 'client') fail('Choose a client account', 400)
    if (member.disabled) fail('Enable this client account before adding a subscription', 409)
    const [plans] = await conn.execute('SELECT * FROM membership_plans WHERE id=? FOR UPDATE', [input.planId])
    const plan = plans[0]
    if (!plan || !plan.active) fail('Choose an active membership plan', 409)
    if (Number(plan.version) !== input.planVersion) fail('The plan price or details changed. Reload and review the plan before saving.', 409)
    if (planCycle({ durationCount: Number(plan.duration_count), durationUnit: plan.duration_unit }) !== input.cycle) fail('The pricing plan does not match the selected subscription period')
    const [overlaps] = await conn.execute('SELECT id FROM member_subscriptions WHERE member_id=? AND cancelled_at IS NULL AND starts_on<? AND ends_on>? FOR UPDATE', [member.id, input.endsOn, input.startsOn])
    if (overlaps.length) fail('This member already has a subscription covering part of these dates. Choose another start date or cancel the overlapping term.', 409)
    const id = crypto.randomBytes(12).toString('base64url')
    await conn.execute(`INSERT INTO member_subscriptions(id,member_id,member_name,plan_id,plan_name,cycle,starts_on,ends_on,price,currency,notes,request_key,request_hash,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id, member.id, member.name, plan.id, plan.name, input.cycle, input.startsOn, input.endsOn, String(plan.price), plan.currency, input.notes, input.requestKey, requestHash, actor.id])
    const [[row]] = await conn.execute(selectSubscriptions + ' WHERE s.id=?', [id])
    await conn.commit()
    return { subscription: publicSubscription(row, financeToday()), replayed: false }
  } catch (error) {
    await conn.rollback()
    if (error.code === 'ER_DUP_ENTRY') fail('This request key was already used. Reload before continuing.', 409)
    throw error
  } finally { conn.release() }
}
export async function cancelSubscription(pool, actor, body) {
  objectBody(body)
  if (typeof body.id !== 'string' || !body.id || body.id.length > 64) fail('subscription id required')
  if (!Number.isInteger(body.version) || body.version < 1) fail('current subscription version required')
  if (typeof body.reason !== 'string' || !body.reason.trim() || body.reason.trim().length > 500) fail('cancellation reason must be 1–500 characters')
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [found] = await conn.execute('SELECT member_id FROM member_subscriptions WHERE id=?', [body.id])
    await authorizeAndLock(conn, actor, found[0]?.member_id)
    const [rows] = await conn.execute('SELECT * FROM member_subscriptions WHERE id=? FOR UPDATE', [body.id])
    const row = rows[0]
    if (!row) fail('subscription not found', 404)
    if (row.cancelled_at || Number(row.version) !== body.version) fail('This subscription changed. Reload before continuing.', 409)
    if (dateText(row.ends_on) <= financeToday()) fail('An expired subscription cannot be cancelled', 409)
    await conn.execute('UPDATE member_subscriptions SET cancelled_at=CURRENT_TIMESTAMP(3),cancelled_by=?,cancellation_reason=?,version=version+1 WHERE id=?', [actor.id, body.reason.trim(), body.id])
    const [[updated]] = await conn.execute(selectSubscriptions + ' WHERE s.id=?', [body.id])
    await conn.commit()
    return publicSubscription(updated, financeToday())
  } catch (error) { await conn.rollback(); throw error } finally { conn.release() }
}
