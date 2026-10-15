import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs/promises'
import { createPool, hashPassword, migrate } from '../db.js'
import { financeToday } from '../subscriptions.js'
import { DEFAULT_REMINDER_SETTINGS, dayDistance, reminderEligible, reminderMessage, queueReminder, dispatchMembershipReminders, scheduleMembershipReminders, reviewPayment, renewalTracker } from '../renewals.js'

test('reminders require reviewed unpaid balances or an unrenewed membership', () => {
  const term = { canRemind: true, status: 'active', paymentStatus: 'unpaid', paymentDueOn: '2026-10-20', price: '25.50', currency: 'USD', planName: 'Monthly', endsOn: '2026-11-01' }
  assert.equal(reminderEligible(term, 'payment'), true)
  for (const patch of [{ paymentStatus: 'paid' }, { paymentStatus: 'unconfirmed' }, { paymentStatus: 'waived' }, { status: 'cancelled' }, { canRemind: false }, { price: '0.00' }]) assert.equal(reminderEligible({ ...term, ...patch }, 'payment'), false)
  assert.equal(reminderEligible({ ...term, nextTermId: 'next' }, 'renewal'), false)
  assert.equal(reminderEligible(term, 'renewal'), true)
  assert.equal(DEFAULT_REMINDER_SETTINGS.enabled, false)
  assert.equal(dayDistance('2028-03-01', '2028-02-28'), 2)
  assert.match(reminderMessage(term, 'payment').body, /USD 25.50/)
})
const database = process.env.TEST_RENEWAL_DB_NAME
test('renewal tracking, reviewed payment status and durable private reminders', { skip: !database, timeout: 30000 }, async t => {
  assert.match(database, /^opengym_test_[a-z0-9_]+$/)
  const pool = createPool({ database }); t.after(() => pool.end())
  const [tables] = await pool.query('SHOW TABLES'); assert.equal(tables.length, 0, 'Use an empty disposable database')
  // Upgrade real subscriptions from the preceding schema without inferring historical debt.
  await pool.query('CREATE TABLE schema_migrations (version VARCHAR(191) PRIMARY KEY)')
  for (const file of ['001_initial.sql', '002_email_password_auth.sql', '003_client_activation.sql', '004_admin_role.sql', '005_membership_plans.sql', '006_member_subscriptions.sql']) {
    await pool.query(await fs.readFile(new URL('../migrations/' + file, import.meta.url), 'utf8'))
    await pool.execute('INSERT INTO schema_migrations(version) VALUES (?)', [file])
  }
  const password = 'ReminderTest2026!'
  for (const [id, role] of [['admin', 'admin'], ['trainer', 'trainer'], ['client', 'client'], ['other', 'client'], ['third', 'client']]) await pool.execute('INSERT INTO users(id,name,email,password_hash,role,activated) VALUES (?,?,?,?,?,TRUE)', [id, id, id + '@test.local', hashPassword(password), role])
  const today = financeToday()
  const shift = days => new Date(Date.parse(today + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10)
  const seed = async (id, memberId, start, end, price = '25.50') => pool.execute(`INSERT INTO member_subscriptions(id,member_id,member_name,plan_name,cycle,starts_on,ends_on,price,currency,request_key,request_hash,created_by) VALUES (?,?,?,'Monthly','monthly',?,?,?,'USD',?,?,'admin')`, [id, memberId, memberId, start, end, price, crypto.randomUUID(), 'x'.repeat(64)])
  await seed('term', 'client', shift(-25), shift(5))
  await seed('expired', 'other', shift(-35), shift(-5))
  await seed('free', 'third', shift(-10), shift(20), '0.00')
  await migrate(pool); await migrate(pool)
  const [[old]] = await pool.query("SELECT payment_status,payment_due_on FROM member_subscriptions WHERE id='term'")
  assert.equal(old.payment_status, 'unconfirmed'); assert.equal(old.payment_due_on, null)
  const port = process.env.TEST_RENEWAL_API_PORT || '33026'
  const child = spawn(process.execPath, ['server.js'], { cwd: new URL('../', import.meta.url), env: { ...process.env, DB_NAME: database, PORT: port, ORIGIN: 'http://localhost:' + port, SESSION_SECRET: 'reminder-test-secret' }, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''; child.stdout.on('data', d => { output += d }); child.stderr.on('data', d => { output += d })
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, 'exit') } })
  for (let i = 0; !output.includes('gym-api on'); i++) { assert.ok(i < 100 && child.exitCode === null, output); await new Promise(r => setTimeout(r, 50)) }
  const request = async (path, { cookie, method = 'GET', body } = {}) => {
    const response = await fetch('http://127.0.0.1:' + port + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
  }
  const cookies = {}
  for (const role of ['admin', 'trainer', 'client', 'other']) cookies[role] = (await request('/api/auth/login', { method: 'POST', body: { email: role + '@test.local', password } })).cookie
  const get = (path, cookie = cookies.admin) => request(path, { cookie })
  const post = (path, body, cookie = cookies.admin, method = 'POST') => request(path, { cookie, method, body })
  const tracker = () => get('/api/admin/renewals')
  await t.test('only admins can view history, review payment, send or configure reminders', async () => {
    for (const cookie of [undefined, cookies.trainer, cookies.client]) for (const [path, method, body] of [['/api/admin/renewals', 'GET'], ['/api/admin/subscription/payment', 'POST', {}], ['/api/admin/subscription/remind', 'POST', { id: 'term', kind: 'payment' }], ['/api/admin/reminder-settings', 'PUT', DEFAULT_REMINDER_SETTINGS]]) assert.equal((await request(path, { cookie, method, body })).status, cookie ? 403 : 401)
    assert.equal((await request('/api/member/reminders')).status, 401)
    assert.equal((await tracker()).data.subscriptions.find(s => s.id === 'term').renewalStatus, 'due_soon')
    assert.equal((await tracker()).data.subscriptions.find(s => s.id === 'expired').renewalStatus, 'overdue')
    assert.equal(await scheduleMembershipReminders(pool), 0)
    assert.equal((await post('/api/admin/subscription/remind', { id: 'term', kind: 'payment' })).status, 409)
  })
  await t.test('reviewed unpaid status requires due dates, records audit and checks stale versions', async () => {
    assert.equal((await post('/api/admin/subscription/payment', { id: 'term', version: 1, paymentStatus: 'unpaid', dueOn: 'bad', note: 'Confirmed' })).status, 400)
    assert.equal((await post('/api/admin/subscription/payment', { id: 'term', version: 1, paymentStatus: 'unpaid', dueOn: shift(-1), note: 'Owner confirmed payment not received' })).status, 200)
    assert.equal((await post('/api/admin/subscription/payment', { id: 'term', version: 1, paymentStatus: 'paid', note: 'Stale' })).status, 409)
    const data = (await tracker()).data
    assert.equal(data.subscriptions.find(s => s.id === 'term').paymentOverdue, true)
    assert.equal(data.paymentEvents[0].from, 'unconfirmed'); assert.equal(data.paymentEvents[0].to, 'unpaid')
    assert.equal((await post('/api/admin/subscription/payment', { id: 'free', version: 1, paymentStatus: 'unpaid', dueOn: today, note: 'Free term' })).status, 400)
  })
  let paymentReminder
  await t.test('manual reminders are private in-app notices, not falsely reported as push successes', async () => {
    const sent = await post('/api/admin/subscription/remind', { id: 'term', kind: 'payment' })
    assert.equal(sent.status, 201); paymentReminder = sent.data.reminder.id; assert.equal(sent.data.reminder.delivery, 'in_app')
    assert.equal((await post('/api/admin/subscription/remind', { id: 'term', kind: 'payment' })).status, 409)
    const own = await get('/api/member/reminders', cookies.client)
    assert.equal(own.data.reminders.length, 1); assert.match(own.data.reminders[0].body, /USD 25.50/)
    assert.deepEqual((await get('/api/member/reminders', cookies.other)).data.reminders, [])
    assert.equal((await post('/api/member/reminder/read', { id: paymentReminder }, cookies.other)).status, 404)
    assert.equal((await post('/api/member/reminder/read', { id: paymentReminder }, cookies.client)).status, 200)
    assert.deepEqual((await get('/api/member/reminders', cookies.client)).data.reminders, [])
  })
  await t.test('scheduled reminders respect lead times, cooldown, enable switch and duplicate-day limits', async () => {
    assert.equal((await post('/api/admin/reminder-settings', { ...DEFAULT_REMINDER_SETTINGS, repeatDays: 0 }, cookies.admin, 'PUT')).status, 400)
    assert.equal((await post('/api/admin/reminder-settings', { ...DEFAULT_REMINDER_SETTINGS, enabled: true }, cookies.admin, 'PUT')).status, 200)
    const first = await scheduleMembershipReminders(pool); assert.ok(first >= 2)
    assert.equal(await scheduleMembershipReminders(pool), 0)
    let fakeSends = 0
    await dispatchMembershipReminders(pool, async () => { fakeSends++; return 1 })
    assert.equal(fakeSends, 0, 'members without push subscriptions receive only in-app notices')
    const [[count]] = await pool.query("SELECT COUNT(*) total FROM subscription_reminders WHERE subscription_id='term' AND kind='payment'")
    assert.equal(count.total, 1)
    await seed('far', 'third', shift(100), shift(130))
    assert.equal(await scheduleMembershipReminders(pool), 0)
  })
  await t.test('paid/waived reviews and next terms suppress pending and visible reminders', async () => {
    await pool.query("INSERT INTO subscription_reminders(id,subscription_id,kind,reminder_date,source) VALUES ('pending-payment','term','payment','2000-01-01','manual')")
    assert.equal((await post('/api/admin/subscription/payment', { id: 'term', version: 2, paymentStatus: 'paid', note: 'Cash payment confirmed by owner' })).status, 200)
    const [[pending]] = await pool.query("SELECT delivery FROM subscription_reminders WHERE id='pending-payment'"); assert.equal(pending.delivery, 'skipped')
    await seed('next', 'client', shift(5), shift(35))
    const data = (await tracker()).data; assert.equal(data.subscriptions.find(s => s.id === 'term').renewalStatus, 'renewed')
    assert.deepEqual((await get('/api/member/reminders', cookies.client)).data.reminders, [])
    assert.equal((await post('/api/admin/subscription/remind', { id: 'term', kind: 'renewal' })).status, 409)
    assert.equal((await post('/api/admin/subscription/payment', { id: 'free', version: 1, paymentStatus: 'waived', note: 'Free trial has no payment due' })).status, 200)
  })
  await t.test('durable claims prevent duplicate sends and support retry, revalidation and lease recovery', async () => {
    await pool.execute("INSERT INTO push_subscriptions(user_id,endpoint_hash,endpoint,keys_json) VALUES ('other',UNHEX(SHA2('fake-reminder',256)),'https://push.invalid/fake','{}')")
    const job = await queueReminder(pool, { id: 'admin' }, { id: 'expired', kind: 'renewal' }).catch(async error => {
      assert.equal(error.status, 409)
      await pool.query("UPDATE subscription_reminders SET delivery='pending',attempts=0 WHERE subscription_id='expired' AND kind='renewal'")
      const [[row]] = await pool.query("SELECT id FROM subscription_reminders WHERE subscription_id='expired' AND kind='renewal'"); return row.id
    })
    let sent = 0
    const send = async () => { sent++; await new Promise(r => setTimeout(r, 25)); return 1 }
    await Promise.all([dispatchMembershipReminders(pool, send, job), dispatchMembershipReminders(pool, send, job)])
    assert.equal(sent, 1)
    const [[accepted]] = await pool.execute('SELECT delivery FROM subscription_reminders WHERE id=?', [job]); assert.equal(accepted.delivery, 'push_sent')
    await pool.execute("UPDATE subscription_reminders SET delivery='pending',attempts=0 WHERE id=?", [job])
    await dispatchMembershipReminders(pool, async () => 0, job)
    const [[failed]] = await pool.execute('SELECT delivery,next_attempt_at FROM subscription_reminders WHERE id=?', [job]); assert.equal(failed.delivery, 'failed'); assert.ok(failed.next_attempt_at)
    await dispatchMembershipReminders(pool, () => assert.fail('must wait until retry time'), job)
    await pool.execute("UPDATE subscription_reminders SET delivery='processing',attempts=1,lease_until=DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 1 MINUTE) WHERE id=?", [job])
    await dispatchMembershipReminders(pool, async () => 1, job)
    const [[recovered]] = await pool.execute('SELECT delivery FROM subscription_reminders WHERE id=?', [job]); assert.equal(recovered.delivery, 'push_sent')
    await pool.execute("UPDATE subscription_reminders SET delivery='processing',attempts=3,lease_until=DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 1 MINUTE) WHERE id=?", [job])
    await dispatchMembershipReminders(pool, () => assert.fail('final exhausted job cannot send again'), job)
    const [[exhausted]] = await pool.execute('SELECT delivery FROM subscription_reminders WHERE id=?', [job]); assert.equal(exhausted.delivery, 'failed')
    await pool.query("UPDATE users SET disabled=TRUE WHERE id='other'")
    await pool.execute("UPDATE subscription_reminders SET delivery='pending',attempts=0,next_attempt_at=NULL WHERE id=?", [job])
    await dispatchMembershipReminders(pool, () => assert.fail('disabled clients must not receive reminders'), job)
    const [[skipped]] = await pool.execute('SELECT delivery FROM subscription_reminders WHERE id=?', [job]); assert.equal(skipped.delivery, 'skipped')
    await migrate(pool)
  })
  await t.test('resolved recent notices do not hide older actionable reminders', async () => {
    await seed('older-due', 'client', shift(-100), shift(-70))
    await reviewPayment(pool, { id: 'admin' }, { id: 'older-due', version: 1, paymentStatus: 'unpaid', dueOn: shift(-70), note: 'Historical unpaid term confirmed' })
    await pool.query("INSERT INTO subscription_reminders(id,subscription_id,kind,reminder_date,source,delivery,created_at) VALUES ('older-actionable','older-due','payment','2000-01-01','manual','in_app','2000-01-01')")
    for (let i = 1; i <= 11; i++) await pool.execute("INSERT INTO subscription_reminders(id,subscription_id,kind,reminder_date,source,delivery) VALUES (?,'term','payment',?,'manual','in_app')", ['resolved-' + i, '2001-01-' + String(i).padStart(2, '0')])
    const notices = (await get('/api/member/reminders', cookies.client)).data.reminders
    assert.ok(notices.some(notice => notice.id === 'older-actionable'))
    assert.ok(notices.every(notice => !notice.id.startsWith('resolved-')))
  })

})
