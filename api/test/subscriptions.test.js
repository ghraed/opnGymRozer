import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import crypto from 'node:crypto'
import { createPool, hashPassword, migrate } from '../db.js'
import { subscriptionEnd, subscriptionStatus, planCycle, validDate } from '../subscription-periods.js'
import { subscriptionInput, financeToday, createSubscription } from '../subscriptions.js'

test('subscription periods use calendar months, leap years and explicit end boundaries', () => {
  for (const [start, cycle, end] of [['2027-01-31', 'monthly', '2027-02-28'], ['2028-01-31', 'monthly', '2028-02-29'], ['2027-01-31', 'quarterly', '2027-04-30'], ['2028-02-29', 'yearly', '2029-02-28'], ['2027-11-30', 'quarterly', '2028-02-29']]) assert.equal(subscriptionEnd(start, cycle), end)
  for (const date of ['2027-02-29', '2027-13-01', '2027-1-01', '1999-12-31', '', null]) assert.equal(validDate(date), false)
  assert.throws(() => subscriptionEnd('9999-12-31', 'yearly'))
  assert.equal(planCycle({ durationCount: 3, durationUnit: 'month' }), 'quarterly')
  assert.equal(planCycle({ durationCount: 12, durationUnit: 'month' }), 'yearly')
  assert.equal(planCycle({ durationCount: 30, durationUnit: 'day' }), 'plan')
  const term = { startsOn: '2027-01-01', endsOn: '2027-02-01' }
  assert.equal(subscriptionStatus(term, '2026-12-31'), 'scheduled')
  assert.equal(subscriptionStatus(term, '2027-01-01'), 'active')
  assert.equal(subscriptionStatus(term, '2027-02-01'), 'expired')
  assert.equal(subscriptionStatus({ ...term, cancelledAt: '2027-01-10' }, '2027-01-15'), 'cancelled')
  assert.match(financeToday(new Date('2026-01-01T23:30:00Z')), /^2026-01-02$/)
})
test('plan durations support day passes, weeks and arbitrary calendar terms', () => {
  for (const [start, durationCount, durationUnit, end] of [
    ['2028-02-28', 2, 'day', '2028-03-01'], ['2027-12-31', 1, 'day', '2028-01-01'],
    ['2027-12-25', 2, 'week', '2028-01-08'], ['2027-12-31', 2, 'month', '2028-02-29'],
    ['2028-02-29', 2, 'year', '2030-02-28'], ['2027-01-31', 6, 'month', '2027-07-31'],
  ]) assert.equal(subscriptionEnd(start, 'plan', { durationCount, durationUnit }), end)
  for (const plan of [null, { durationCount: 0, durationUnit: 'day' }, { durationCount: 1.5, durationUnit: 'day' }, { durationCount: 1, durationUnit: 'bad' }]) assert.throws(() => subscriptionEnd('2027-01-01', 'plan', plan))
  assert.throws(() => subscriptionEnd('9999-12-31', 'plan', { durationCount: 1, durationUnit: 'day' }))
})
test('subscription inputs reject malformed dates, periods, identifiers and missing plan versions', () => {
  const input = { memberId: 'member', planId: 'plan', planVersion: 1, cycle: 'monthly', startsOn: '2027-01-01', requestKey: crypto.randomUUID() }
  for (const patch of [{ cycle: 'weekly' }, { startsOn: '2027-02-30' }, { planVersion: 0 }, { requestKey: 'short' }, { memberId: '../x' }, { notes: true }, { notes: 'x'.repeat(1001) }]) assert.throws(() => subscriptionInput({ ...input, ...patch }), { status: 400 })
  for (const body of [null, [], {}]) assert.throws(() => subscriptionInput(body), { status: 400 })
  assert.equal(subscriptionInput(input).endsOn, '2027-02-01')
  assert.equal(subscriptionInput({ ...input, cycle: 'plan', endsOn: '2099-01-01', durationCount: 999 }).endsOn, null)
  assert.throws(() => subscriptionInput({ ...input, cycle: 'plan', startsOn: '2027-02-30' }), { status: 400 })
  const paid = { ...input, paymentStatus: 'paid', receivedOn: financeToday(), paymentMethod: 'card' }
  assert.equal(subscriptionInput(paid).paymentStatus, 'paid')
  for (const patch of [{ paymentStatus: 'unpaid' }, { receivedOn: undefined }, { receivedOn: '2027-02-30' }, { receivedOn: '9999-01-01' }, { paymentMethod: 'invalid' }]) assert.throws(() => subscriptionInput({ ...paid, ...patch }), { status: 400 })
})

const database = process.env.TEST_SUBSCRIPTION_DB_NAME
test('subscriptions and Finance are restricted to admins and retain accurate membership history', { skip: !database, timeout: 30000 }, async t => {
  assert.match(database, /^opengym_test_[a-z0-9_]+$/)
  const pool = createPool({ database }); t.after(() => pool.end())
  const [tables] = await pool.query('SHOW TABLES'); assert.equal(tables.length, 0, 'Use an empty disposable database')
  await migrate(pool); await migrate(pool)
  const password = 'SubscriptionTest2026!'
  for (const [id, role] of [['admin', 'admin'], ['trainer', 'trainer'], ['client', 'client'], ['other', 'client']]) await pool.execute('INSERT INTO users(id,name,email,password_hash,role,activated) VALUES (?,?,?,?,?,TRUE)', [id, id, id + '@test.local', hashPassword(password), role])
  const port = process.env.TEST_SUBSCRIPTION_API_PORT || '33024'
  const child = spawn(process.execPath, ['server.js'], { cwd: new URL('../', import.meta.url), env: { ...process.env, DB_NAME: database, PORT: port, ORIGIN: 'http://localhost:' + port, SESSION_SECRET: 'subscription-test-secret' }, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''; child.stdout.on('data', d => { output += d }); child.stderr.on('data', d => { output += d })
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, 'exit') } })
  for (let i = 0; !output.includes('gym-api on'); i++) { assert.ok(i < 100 && child.exitCode === null, output); await new Promise(r => setTimeout(r, 50)) }
  const request = async (path, { cookie, method = 'GET', body } = {}) => {
    const response = await fetch('http://127.0.0.1:' + port + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
  }
  const cookies = {}
  for (const role of ['admin', 'trainer', 'client']) cookies[role] = (await request('/api/auth/login', { method: 'POST', body: { email: role + '@test.local', password } })).cookie
  const get = path => request(path, { cookie: cookies.admin })
  const post = (path, body) => request(path, { method: 'POST', cookie: cookies.admin, body })
  const listing = () => get('/api/admin/subscriptions')
  const plans = {}
  for (const [cycle, durationCount, durationUnit] of [['monthly', 1, 'month'], ['quarterly', 3, 'month'], ['yearly', 1, 'year']]) {
    const result = await post('/api/admin/membership-plans', { name: cycle, description: '', durationCount, durationUnit, price: '25.50', currency: 'USD' })
    assert.equal(result.status, 201); plans[cycle] = result.data.plan
  }
  const body = (cycle, startsOn, patch = {}) => ({ memberId: 'client', planId: plans[cycle].id, planVersion: plans[cycle].version, cycle, startsOn, requestKey: crypto.randomUUID(), ...patch })
  await t.test('guests, clients and trainers cannot access Finance, subscription history or actions', async () => {
    for (const cookie of [undefined, cookies.client, cookies.trainer]) for (const [path, method, payload] of [['/api/admin/finance', 'GET'], ['/api/admin/subscriptions', 'GET'], ['/api/admin/subscriptions', 'POST', body('monthly', '2027-01-01')], ['/api/admin/subscription/cancel', 'POST', { id: 'x', version: 1, reason: 'No' }]]) assert.equal((await request(path, { cookie, method, body: payload })).status, cookie ? 403 : 401)
    const overview = await get('/api/admin/finance'); assert.equal(overview.status, 200); assert.equal(overview.data.activePlans, 3); assert.equal(overview.data.activeSubscriptions, 0)
  })
  let monthly
  await t.test('creates all three periods, protects agreed prices and safely replays submissions', async () => {
    const first = body('monthly', '2090-01-31', { price: '0', currency: 'LBP', endsOn: '2099-01-01' })
    const created = await post('/api/admin/subscriptions', first); assert.equal(created.status, 201); monthly = created.data.subscription
    assert.equal(monthly.endsOn, '2090-02-28'); assert.equal(monthly.price, '25.50'); assert.equal(monthly.currency, 'USD'); assert.equal(monthly.status, 'scheduled')
    const replay = await post('/api/admin/subscriptions', first); assert.equal(replay.status, 200); assert.equal(replay.data.subscription.id, monthly.id)
    assert.equal((await post('/api/admin/subscriptions', { ...first, notes: 'different' })).status, 409)
    const quarterly = await post('/api/admin/subscriptions', body('quarterly', '2091-01-31')); assert.equal(quarterly.status, 201); assert.equal(quarterly.data.subscription.endsOn, '2091-04-30')
    const yearly = await post('/api/admin/subscriptions', body('yearly', '2092-02-29')); assert.equal(yearly.status, 201); assert.equal(yearly.data.subscription.endsOn, '2093-02-28')
    const changed = await request('/api/admin/membership-plan', { cookie: cookies.admin, method: 'PUT', body: { ...plans.monthly, name: 'New price', price: '99.99' } })
    assert.equal(changed.status, 200)
    const saved = (await listing()).data.subscriptions.find(s => s.id === monthly.id)
    assert.equal(saved.price, '25.50'); assert.equal(saved.planName, 'monthly')
    assert.equal((await post('/api/admin/subscriptions', body('monthly', '2094-01-01'))).status, 409)
    plans.monthly = changed.data.plan
    assert.equal((await post('/api/admin/subscriptions', first)).status, 200, 'retry returns original even after price changes')
  })
  await t.test('rejects mismatched plans, disabled clients, staff targets and archived plans', async () => {
    assert.equal((await post('/api/admin/subscriptions', body('quarterly', '2094-01-01', { planId: plans.monthly.id, planVersion: plans.monthly.version }))).status, 400)
    assert.equal((await post('/api/admin/subscriptions', body('monthly', '2094-01-01', { memberId: 'trainer' }))).status, 400)
    await pool.execute("UPDATE users SET disabled=TRUE WHERE id='other'")
    assert.equal((await post('/api/admin/subscriptions', body('monthly', '2094-01-01', { memberId: 'other' }))).status, 409)
    await pool.execute("UPDATE users SET disabled=FALSE WHERE id='other'")
    const archived = await post('/api/admin/membership-plan/status', { id: plans.yearly.id, version: plans.yearly.version, active: false })
    assert.equal(archived.status, 200)
    assert.equal((await post('/api/admin/subscriptions', body('yearly', '2094-01-01'))).status, 409)
  })
  await t.test('overlaps are blocked, adjacent terms are allowed and concurrent creation is serialized', async () => {
    assert.equal((await post('/api/admin/subscriptions', body('monthly', '2090-02-15'))).status, 409)
    assert.equal((await post('/api/admin/subscriptions', body('monthly', monthly.endsOn))).status, 201)
    const results = await Promise.all([post('/api/admin/subscriptions', body('monthly', '2095-01-01')), post('/api/admin/subscriptions', body('monthly', '2095-01-01'))])
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409])
    const duplicate = body('monthly', '2096-01-01')
    const same = await Promise.all([post('/api/admin/subscriptions', duplicate), post('/api/admin/subscriptions', duplicate)])
    assert.deepEqual(same.map(r => r.status).sort(), [200, 201]); assert.equal(same[0].data.subscription.id, same[1].data.subscription.id)
  })
  await t.test('plan-based renewals use stored durations, preserve snapshots and safely replay', async () => {
    for (const [durationCount, durationUnit, startsOn, endsOn] of [[1, 'day', '2080-02-28', '2080-02-29'], [2, 'week', '2081-12-25', '2082-01-08'], [2, 'month', '2083-12-31', '2084-02-29']]) {
      const result = await post('/api/admin/membership-plans', { name: 'Flexible plan', durationCount, durationUnit, price: '12.50', currency: 'USD' })
      assert.equal(result.status, 201)
      const plan = result.data.plan
      assert.equal(plan.subscriptionCycle, 'plan')
      const input = { memberId: 'client', planId: plan.id, planVersion: plan.version, startsOn, cycle: 'plan', requestKey: crypto.randomUUID(), endsOn: '2099-01-01', durationCount: 999, price: '0' }
      const created = await post('/api/admin/subscriptions', input)
      assert.equal(created.status, 201); assert.equal(created.data.subscription.endsOn, endsOn)
      assert.equal(created.data.subscription.durationCount, durationCount); assert.equal(created.data.subscription.durationUnit, durationUnit)
      assert.equal(created.data.subscription.price, '12.50')
      assert.equal((await post('/api/admin/subscriptions', { ...input, requestKey: crypto.randomUUID() })).status, 409)
      assert.equal((await post('/api/admin/subscriptions', { ...input, cycle: 'monthly', requestKey: crypto.randomUUID() })).status, 400)
      const changed = await request('/api/admin/membership-plan', { cookie: cookies.admin, method: 'PUT', body: { ...plan, durationCount: 9, price: '99.00' } })
      assert.equal(changed.status, 200)
      const replay = await post('/api/admin/subscriptions', input)
      assert.equal(replay.status, 200); assert.equal(replay.data.subscription.endsOn, endsOn); assert.equal(replay.data.subscription.durationCount, durationCount)
      assert.equal((await post('/api/admin/subscriptions', { ...input, requestKey: crypto.randomUUID() })).status, 409, 'stale plans cannot be booked')
    }
  })
  await t.test('cancellation keeps history and allows replacement coverage', async () => {
    assert.equal((await post('/api/admin/subscription/cancel', { id: monthly.id, version: 1, reason: '' })).status, 400)
    const cancelled = await post('/api/admin/subscription/cancel', { id: monthly.id, version: 1, reason: 'Member changed dates' })
    assert.equal(cancelled.status, 200); assert.equal(cancelled.data.subscription.status, 'cancelled'); assert.equal(cancelled.data.subscription.cancellationReason, 'Member changed dates')
    assert.equal((await post('/api/admin/subscription/cancel', { id: monthly.id, version: 1, reason: 'Again' })).status, 409)
    assert.equal((await post('/api/admin/subscriptions', body('monthly', monthly.startsOn))).status, 201)
    assert.ok((await listing()).data.subscriptions.some(s => s.id === monthly.id))
  })
  await t.test('statuses and finance overview use the server business date; deletion retains subscription history', async () => {
    const today = (await listing()).data.asOf
    const active = await post('/api/admin/subscriptions', body('monthly', today, { memberId: 'other' })); assert.equal(active.status, 201); assert.equal(active.data.subscription.status, 'active')
    const expired = await post('/api/admin/subscriptions', body('monthly', '2000-01-01', { memberId: 'other' })); assert.equal(expired.status, 201); assert.equal(expired.data.subscription.status, 'expired')
    assert.equal((await post('/api/admin/subscription/cancel', { id: expired.data.subscription.id, version: 1, reason: 'Too late' })).status, 409)
    const overview = await get('/api/admin/finance'); assert.equal(overview.data.activeSubscriptions, 1); assert.equal(overview.data.expiredSubscriptions, 1); assert.equal(overview.data.cancelledSubscriptions, 1)
    assert.ok(overview.data.scheduledSubscriptions >= 3)
    assert.equal((await request('/api/admin/user', { cookie: cookies.admin, method: 'DELETE', body: { id: 'other' } })).status, 200)
    const retained = (await listing()).data.subscriptions.find(s => s.id === active.data.subscription.id)
    assert.equal(retained.memberId, null); assert.equal(retained.memberName, 'other'); assert.equal(retained.memberEmail, null); assert.equal(retained.price, '99.99')
    await migrate(pool)
    assert.ok((await listing()).data.subscriptions.length >= 8)
  })
  await t.test('confirmed paid renewals create exactly one linked receipt and payment audit event', async () => {
    const receivedOn = financeToday()
    const input = body('monthly', '2100-01-01', { paymentStatus: 'paid', receivedOn, paymentMethod: 'card', price: '0', currency: 'LBP' })
    const responses = await Promise.all([post('/api/admin/subscriptions', input), post('/api/admin/subscriptions', input)])
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 201])
    const term = responses[0].data.subscription
    assert.equal(term.paymentStatus, 'paid')
    assert.equal(term.price, '99.99')
    assert.equal((await post('/api/admin/subscriptions', input)).data.subscription.id, term.id)
    assert.equal((await post('/api/admin/subscriptions', { ...input, paymentMethod: 'cash' })).status, 409)
    const [receipts] = await pool.execute('SELECT * FROM finance_entries WHERE source_subscription_id=?', [term.id])
    assert.equal(receipts.length, 1)
    assert.equal(String(receipts[0].amount), '99.99')
    assert.equal(receipts[0].currency, 'USD')
    assert.equal(receipts[0].method, 'card')
    assert.equal(receipts[0].entry_date.toISOString().slice(0, 10), receivedOn, 'Revenue uses the payment date, not future coverage dates')
    const [events] = await pool.execute('SELECT * FROM subscription_payment_events WHERE subscription_id=?', [term.id])
    assert.equal(events.length, 1)
    assert.equal(events[0].previous_status, 'unconfirmed')
    assert.equal(events[0].payment_status, 'paid')
    const period = new URLSearchParams({ from: receivedOn, to: receivedOn })
    const report = await get('/api/admin/profit-loss?' + period)
    assert.equal(report.data.currencies.find(row => row.currency === 'USD').revenue, '99.99')
    const ledger = await get('/api/admin/ledger?' + period + '&kind=revenue&currency=USD&status=posted&page=1')
    assert.ok(ledger.data.entries.some(entry => entry.sourceSubscriptionId === term.id))
  })
  await t.test('a failed revenue write rolls back the renewal and allows a safe retry', async () => {
    const input = body('monthly', '2101-01-01', { paymentStatus: 'paid', receivedOn: financeToday(), paymentMethod: 'cash' })
    // Inject a receipt-write failure while using a real connection and transaction.
    // This needs no global MySQL settings or privileged database triggers.
    const failingPool = { async getConnection() {
      const connection = await pool.getConnection()
      return new Proxy(connection, { get(target, key) {
        if (key === 'execute') return (sql, values) => {
          if (sql.startsWith('INSERT INTO finance_entries')) throw new Error('Receipt failure test')
          return target.execute(sql, values)
        }
        const value = Reflect.get(target, key)
        return typeof value === 'function' ? value.bind(target) : value
      } })
    } }
    await assert.rejects(createSubscription(failingPool, { id: 'admin' }, input), /Receipt failure test/)
    const [[count]] = await pool.execute('SELECT COUNT(*) total FROM member_subscriptions WHERE request_key=?', [input.requestKey])
    assert.equal(count.total, 0)
    const retry = await post('/api/admin/subscriptions', input)
    assert.equal(retry.status, 201)
    assert.equal(retry.data.subscription.paymentStatus, 'paid')
  })
  await t.test('free paid terms create no revenue and ordinary new terms remain unconfirmed', async () => {
    const plan = (await post('/api/admin/membership-plans', { name: 'Free month', durationCount: 1, durationUnit: 'month', price: '0', currency: 'USD' })).data.plan
    const free = await post('/api/admin/subscriptions', { memberId: 'client', planId: plan.id, planVersion: plan.version, cycle: plan.subscriptionCycle, startsOn: '2102-01-01', requestKey: crypto.randomUUID(), paymentStatus: 'paid', receivedOn: financeToday(), paymentMethod: 'other' })
    assert.equal(free.status, 201)
    assert.equal(free.data.subscription.paymentStatus, 'paid')
    const [[count]] = await pool.execute('SELECT COUNT(*) total FROM finance_entries WHERE source_subscription_id=?', [free.data.subscription.id])
    assert.equal(count.total, 0)
    const ordinary = await post('/api/admin/subscriptions', body('monthly', '2103-01-01'))
    assert.equal(ordinary.status, 201)
    assert.equal(ordinary.data.subscription.paymentStatus, 'unconfirmed')
  })

})
