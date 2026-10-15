import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createPool, hashPassword, migrate } from '../db.js'
import { planInput } from '../membership-plans.js'

const monthly = { name: ' Monthly ', description: ' Gym access ', durationCount: 1, durationUnit: 'month', price: '25.5', currency: 'USD' }
test('membership prices preserve decimal precision, zero and currency boundaries', () => {
  assert.deepEqual(planInput(monthly), { ...monthly, name: 'Monthly', description: 'Gym access', price: '25.50' })
  for (const [input, expected] of [['0', '0.00'], ['0.01', '0.01'], ['9999999999.99', '9999999999.99'], [20, '20.00'], ['2000000', '2000000.00']]) {
    assert.equal(planInput({ ...monthly, price: input, currency: 'LBP' }).price, expected)
  }
  for (const price of ['-1', '1.001', '10000000000', '1e3', '1,000', '01.00', '', null, false, {}, [], Infinity, NaN]) assert.throws(() => planInput({ ...monthly, price }), { status: 400 })
})
test('membership plans require valid names, currency and whole durations', () => {
  for (const body of [null, [], {}, { ...monthly, name: ' ' }, { ...monthly, name: 'x'.repeat(81) }, { ...monthly, description: 'x'.repeat(2001) }, { ...monthly, durationCount: '1' }, { ...monthly, durationCount: 0 }, { ...monthly, durationCount: 1.5 }, { ...monthly, durationCount: 3651 }, { ...monthly, durationUnit: 'forever' }, { ...monthly, currency: 'EUR' }]) assert.throws(() => planInput(body), { status: 400 })
  for (const unit of ['day', 'week', 'month', 'year']) assert.equal(planInput({ ...monthly, durationUnit: unit }).durationUnit, unit)
})

const database = process.env.TEST_MEMBERSHIP_DB_NAME
test('membership catalog is admin-only, persistent and safe from stale writes', { skip: !database, timeout: 30000 }, async t => {
  assert.match(database, /^opengym_test_[a-z0-9_]+$/)
  const pool = createPool({ database }); t.after(() => pool.end())
  const [tables] = await pool.query('SHOW TABLES'); assert.equal(tables.length, 0, 'Use an empty disposable database')
  // Reproduce a real upgrade with existing accounts before membership migration.
  const fs = await import('node:fs/promises')
  await pool.query('CREATE TABLE schema_migrations (version VARCHAR(191) PRIMARY KEY)')
  for (const file of ['001_initial.sql', '002_email_password_auth.sql', '003_client_activation.sql', '004_admin_role.sql']) {
    await pool.query(await fs.readFile(new URL('../migrations/' + file, import.meta.url), 'utf8'))
    await pool.execute('INSERT INTO schema_migrations(version) VALUES (?)', [file])
  }
  const password = 'MembershipTest2026!'
  for (const role of ['admin', 'trainer', 'client']) await pool.execute('INSERT INTO users(id,name,email,password_hash,role,activated) VALUES (?,?,?,?,?,TRUE)', [role, role, role + '@test.local', hashPassword(password), role])
  await migrate(pool); await migrate(pool)
  const [[preserved]] = await pool.query('SELECT COUNT(*) total FROM users'); assert.equal(preserved.total, 3)
  const port = process.env.TEST_MEMBERSHIP_API_PORT || '33022'
  const child = spawn(process.execPath, ['server.js'], { cwd: new URL('../', import.meta.url), env: { ...process.env, DB_NAME: database, PORT: port, ORIGIN: 'http://localhost:' + port, SESSION_SECRET: 'membership-test-secret' }, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''; child.stdout.on('data', d => { output += d }); child.stderr.on('data', d => { output += d })
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, 'exit') } })
  for (let i = 0; !output.includes('gym-api on'); i++) { assert.ok(i < 100 && child.exitCode === null, output); await new Promise(r => setTimeout(r, 50)) }
  const request = async (path, { cookie, method = 'GET', body } = {}) => {
    const response = await fetch('http://127.0.0.1:' + port + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
  }
  const cookies = {}
  for (const role of ['admin', 'trainer', 'client']) cookies[role] = (await request('/api/auth/login', { method: 'POST', body: { email: role + '@test.local', password } })).cookie
  const catalog = () => request('/api/admin/membership-plans', { cookie: cookies.admin })
  const write = (body, path = '/api/admin/membership-plans', method = 'POST') => request(path, { cookie: cookies.admin, method, body })
  await t.test('guests, clients and trainers cannot read or mutate membership pricing', async () => {
    for (const cookie of [undefined, cookies.client, cookies.trainer]) for (const [path, method, body] of [
      ['/api/admin/membership-plans', 'GET'], ['/api/admin/membership-plans', 'POST', monthly],
      ['/api/admin/membership-plan', 'PUT', { ...monthly, id: 'x', version: 1 }],
      ['/api/admin/membership-plan/status', 'POST', { id: 'x', version: 1, active: false }],
    ]) assert.equal((await request(path, { cookie, method, body })).status, cookie ? 403 : 401)
    assert.deepEqual((await catalog()).data.plans, [])
  })
  let plan
  await t.test('admin creates priced, free and LBP plans and receives exact decimal strings', async () => {
    const created = await write({ ...monthly, active: false, created_by: 'trainer' })
    assert.equal(created.status, 201); plan = created.data.plan
    assert.equal(plan.name, 'Monthly'); assert.equal(plan.price, '25.50'); assert.equal(plan.version, 1); assert.equal(plan.active, true)
    const free = await write({ ...monthly, name: 'Trial', durationCount: 7, durationUnit: 'day', price: '0' })
    assert.equal(free.status, 201); assert.equal(free.data.plan.price, '0.00')
    const lbp = await write({ ...monthly, name: 'Annual LBP', durationCount: 1, durationUnit: 'year', price: '9999999999.99', currency: 'LBP' })
    assert.equal(lbp.status, 201); assert.equal(lbp.data.plan.price, '9999999999.99')
    const listing = await catalog(); assert.equal(listing.data.plans.length, 3)
    const [[stored]] = await pool.execute('SELECT created_by FROM membership_plans WHERE id=?', [plan.id]); assert.equal(stored.created_by, 'admin')
  })
  await t.test('invalid input never creates or corrupts plans', async () => {
    for (const body of [null, [], { ...monthly, price: '-5' }, { ...monthly, durationCount: 0 }, { ...monthly, price: '5.999' }]) assert.equal((await write(body)).status, 400)
    assert.equal((await write({ ...monthly, id: plan.id }, '/api/admin/membership-plan', 'PUT')).status, 400)
    assert.equal((await write({ ...monthly, id: 'missing', version: 1 }, '/api/admin/membership-plan', 'PUT')).status, 404)
    assert.equal((await catalog()).data.plans.length, 3)
  })
  await t.test('edits persist and simultaneous edits cannot overwrite a newer price', async () => {
    const changes = { ...monthly, id: plan.id, version: plan.version }
    const results = await Promise.all([write({ ...changes, price: '30' }, '/api/admin/membership-plan', 'PUT'), write({ ...changes, price: '35' }, '/api/admin/membership-plan', 'PUT')])
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409])
    plan = results.find(r => r.status === 200).data.plan
    assert.equal(plan.version, 2)
    assert.equal((await catalog()).data.plans.find(p => p.id === plan.id).price, plan.price)
  })
  await t.test('archive and restore keep the plan, reject stale actions and validate boolean status', async () => {
    const path = '/api/admin/membership-plan/status'
    assert.equal((await write({ id: plan.id, version: plan.version, active: 'false' }, path)).status, 400)
    const archived = await write({ id: plan.id, version: plan.version, active: false }, path)
    assert.equal(archived.status, 200); assert.equal(archived.data.plan.active, false)
    assert.equal((await write({ id: plan.id, version: plan.version, active: true }, path)).status, 409)
    plan = archived.data.plan
    const restored = await write({ id: plan.id, version: plan.version, active: true }, path)
    assert.equal(restored.status, 200); assert.equal(restored.data.plan.active, true)
    assert.equal(restored.data.plan.price, plan.price)
    assert.equal((await catalog()).data.plans.length, 3)
  })
  await t.test('disabled admins cannot access pricing and migration remains idempotent with saved plans', async () => {
    await pool.execute("UPDATE users SET disabled=TRUE WHERE id='admin'")
    assert.equal((await catalog()).status, 401)
    assert.equal((await write(monthly)).status, 401)
    await migrate(pool)
    const [[count]] = await pool.query('SELECT COUNT(*) total FROM membership_plans'); assert.equal(count.total, 3)
  })
})
