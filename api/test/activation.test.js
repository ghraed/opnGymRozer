import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createPool, hashPassword, migrate } from '../db.js'

// Run against an empty disposable MySQL database, never the application database:
// TEST_DB_NAME=opengym_test_activation DB_PORT=33317 npm --prefix api test
const database = process.env.TEST_DB_NAME

test('trainer activation protects new clients while preserving existing accounts', { skip: !database, timeout: 30000 }, async t => {
  assert.match(database, /^opengym_test_[a-z0-9_]+$/)
  const pool = createPool({ database })
  t.after(() => pool.end())
  const [tables] = await pool.query('SHOW TABLES')
  assert.equal(tables.length, 0, 'Use a new, empty test database')

  // Reproduce an upgrade from the schema before trainer activation existed.
  await pool.query('CREATE TABLE schema_migrations (version VARCHAR(191) PRIMARY KEY)')
  for (const file of ['001_initial.sql', '002_email_password_auth.sql']) {
    await pool.query(await fs.readFile(new URL('../migrations/' + file, import.meta.url), 'utf8'))
    await pool.execute('INSERT INTO schema_migrations(version) VALUES (?)', [file])
  }
  const password = 'ActivationTest2026!'
  for (const [id, role, disabled] of [['existing', 'client', false], ['trainer', 'trainer', false], ['disabled', 'client', true]]) {
    await pool.execute('INSERT INTO users(id,name,email,password_hash,role,disabled) VALUES (?,?,?,?,?,?)', [id, id, id + '@test.local', hashPassword(password), role, disabled])
  }
  await migrate(pool)
  await t.test('migration preserves existing access and suspension, and runs once', async () => {
    const [users] = await pool.query('SELECT id,activated,disabled FROM users')
    assert.ok(users.every(u => u.activated === 1))
    assert.equal(users.find(u => u.id === 'disabled').disabled, 1)
    await migrate(pool)
  })

  const port = process.env.TEST_API_PORT || '33019'
  const child = spawn(process.execPath, ['server.js'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, DB_NAME: database, PORT: port, ORIGIN: 'http://localhost:' + port, INVITE_ONLY: '0', SESSION_SECRET: 'activation-test-secret' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', data => { output += data })
  child.stderr.on('data', data => { output += data })
  t.after(async () => { if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit') } })
  for (let i = 0; !output.includes('gym-api on'); i++) {
    assert.ok(i < 100 && child.exitCode === null, output || 'API did not start')
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  const request = async (path, { cookie, method = 'GET', body } = {}) => {
    const response = await fetch('http://127.0.0.1:' + port + path, {
      method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
  }
  const login = email => request('/api/auth/login', { method: 'POST', body: { email, password } })
  const trainer = await login('trainer@test.local')
  const existing = await login('existing@test.local')
  let client, pendingLogin

  await t.test('new registration and subsequent login authenticate a pending client', async () => {
    client = await request('/api/auth/register', { method: 'POST', body: { name: 'New client', email: 'new@test.local', password } })
    assert.equal(client.status, 200)
    assert.equal(client.data.user.activated, false)
    assert.ok(client.cookie)
    pendingLogin = await login('new@test.local')
    assert.equal(pendingLogin.status, 200)
    assert.equal(pendingLogin.data.user.activated, false)
    const me = await request('/api/me', { cookie: client.cookie })
    assert.equal(me.status, 200)
    assert.equal(me.data.user.activated, false)
    assert.equal((await request('/api/data', { cookie: existing.cookie })).status, 200)
    assert.equal((await request('/api/admin/users', { cookie: trainer.cookie })).status, 200)
  })
  await t.test('pending sessions cannot read/write workout data, send push, or activate themselves', async () => {
    for (const [path, method, body] of [
      ['/api/data', 'GET'], ['/api/data', 'PUT', { state: { activated: true } }],
      ['/api/activity', 'POST', { active: true }], ['/api/push/subscribe', 'POST', {}],
      ['/api/push/test', 'POST', {}], ['/api/push/rest-timer', 'POST', { seconds: 1 }],
      ['/api/admin/user/activate', 'POST', { id: client.data.user.id }],
    ]) {
      const result = await request(path, { cookie: client.cookie, method, body })
      assert.equal(result.status, 403, path)
      assert.equal(result.data.code, 'ACCOUNT_PENDING', path)
    }
    assert.equal((await request('/api/admin/user/activate', { cookie: existing.cookie, method: 'POST', body: { id: client.data.user.id } })).status, 403)
    assert.equal((await request('/api/admin/user/activate', { method: 'POST', body: { id: client.data.user.id } })).status, 401)
    assert.equal((await request('/api/logout', { cookie: pendingLogin.cookie, method: 'POST', body: {} })).status, 200)
  })
  await t.test('trainer can see pending status, prepare a plan, and activate the client', async () => {
    const listing = await request('/api/admin/users', { cookie: trainer.cookie })
    assert.equal(listing.data.users.find(u => u.id === client.data.user.id).activated, false)
    const detail = await request('/api/admin/user?id=' + client.data.user.id, { cookie: trainer.cookie })
    assert.equal(detail.data.user.activated, false)
    assert.equal((await request('/api/admin/client/plan', { cookie: trainer.cookie, method: 'PUT', body: { id: client.data.user.id, plan: { routines: [] }, baseVersion: detail.data.revisions.plan } })).status, 200)
    const result = await request('/api/admin/user/activate', { cookie: trainer.cookie, method: 'POST', body: { id: client.data.user.id } })
    assert.equal(result.status, 200)
    assert.equal(result.data.activated, true)
    assert.equal((await request('/api/admin/user/activate', { cookie: trainer.cookie, method: 'POST', body: { id: client.data.user.id } })).status, 200)
  })
  await t.test('existing pending session gains access after approval without another login', async () => {
    const me = await request('/api/me', { cookie: client.cookie })
    assert.equal(me.data.user.activated, true)
    assert.equal((await request('/api/data', { cookie: client.cookie })).status, 200)
    const blocked = await request('/api/activity', { cookie: client.cookie, method: 'POST', body: { active: true } })
    assert.equal(blocked.status, 403)
    assert.equal(blocked.data.code, 'PROFILE_REQUIRED')
    const incomplete = await request('/api/data', { cookie: client.cookie, method: 'PUT', body: { state: { onboarding: { completedAt: Date.now() } } } })
    assert.equal(incomplete.status, 403)
    assert.equal(incomplete.data.code, 'PROFILE_REQUIRED')
    assert.equal((await request('/api/data', { cookie: client.cookie, method: 'PUT', body: { state: { workouts: [], routines: [], onboarding: { goal: 'muscle', currentWeight: 80, height: 175, days: 3, experience: 'beginner', equipment: 'full_gym', body: 'male', completedAt: Date.now() } }, revisions: {} } })).status, 200)
    assert.equal((await request('/api/activity', { cookie: client.cookie, method: 'POST', body: { active: true } })).status, 200)
    assert.equal((await login('new@test.local')).data.user.activated, true)
  })
  await t.test('profile photos sync to the client dashboard and invalid photos are rejected', async () => {
    const current = await request('/api/data', { cookie: client.cookie })
    const photo = 'data:image/jpeg;base64,/9j/2Q=='
    const state = { ...current.data.state, profileImage: photo }
    const saved = await request('/api/data', { cookie: client.cookie, method: 'PUT', body: { state, revisions: current.data.revisions } })
    assert.equal(saved.status, 200)
    const detail = await request('/api/admin/user?id=' + client.data.user.id, { cookie: trainer.cookie })
    assert.equal(detail.data.profileImage, photo)
    for (const invalid of ['https://example.com/photo.jpg', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,' + 'A'.repeat(300001)]) {
      assert.equal((await request('/api/data', { cookie: client.cookie, method: 'PUT', body: { state: { ...state, profileImage: invalid }, revisions: saved.data.revisions } })).status, 400)
    }
    const removed = await request('/api/data', { cookie: client.cookie, method: 'PUT', body: { state: { ...state, profileImage: null }, revisions: saved.data.revisions } })
    assert.equal(removed.status, 200)
    assert.equal(removed.data.state.profileImage, null)
  })
  await t.test('activation cannot bypass suspension or target a trainer', async () => {
    assert.equal((await request('/api/admin/user/activate', { cookie: trainer.cookie, method: 'POST', body: { id: 'disabled' } })).status, 409)
    assert.equal((await login('disabled@test.local')).status, 403)
    assert.equal((await request('/api/admin/user/activate', { cookie: trainer.cookie, method: 'POST', body: { id: 'trainer' } })).status, 404)
    assert.equal((await request('/api/admin/user/activate', { cookie: trainer.cookie, method: 'POST', body: { id: 'missing' } })).status, 404)
  })
  await t.test('only trainers can disable clients, and re-enabling preserves data without restoring old sessions', async () => {
    const id = client.data.user.id
    const before = await request('/api/data', { cookie: client.cookie })
    assert.equal((await request('/api/admin/user/disable', { method: 'POST', body: { id, disabled: true } })).status, 401)
    assert.equal((await request('/api/admin/user/disable', { cookie: client.cookie, method: 'POST', body: { id, disabled: true } })).status, 403)
    assert.equal((await request('/api/admin/user/disable', { cookie: trainer.cookie, method: 'POST', body: { id: 'trainer', disabled: true } })).status, 400)
    assert.equal((await request('/api/admin/user/disable', { cookie: trainer.cookie, method: 'POST', body: { id, disabled: 'false' } })).status, 400)
    const disabled = await request('/api/admin/user/disable', { cookie: trainer.cookie, method: 'POST', body: { id, disabled: true } })
    assert.equal(disabled.status, 200)
    assert.equal(disabled.data.disabled, true)
    assert.equal((await login('new@test.local')).status, 403)
    assert.equal((await request('/api/me', { cookie: client.cookie })).status, 401)
    assert.equal((await request('/api/data', { cookie: client.cookie })).status, 401)
    const list = await request('/api/admin/users', { cookie: trainer.cookie })
    assert.equal(list.data.users.find(u => u.id === id).live, null)
    assert.equal((await request('/api/admin/user/disable', { cookie: trainer.cookie, method: 'POST', body: { id, disabled: false } })).status, 200)
    assert.equal((await request('/api/me', { cookie: client.cookie })).status, 401)
    const enabled = await login('new@test.local')
    assert.equal(enabled.status, 200)
    client.cookie = enabled.cookie
    const after = await request('/api/data', { cookie: client.cookie })
    assert.deepEqual(after.data, before.data)
  })
  await t.test('enabling a pending client does not approve activation', async () => {
    const pending = await request('/api/auth/register', { method: 'POST', body: { name: 'Pending', email: 'pending@test.local', password } })
    const id = pending.data.user.id
    for (const disabled of [true, false]) assert.equal((await request('/api/admin/user/disable', { cookie: trainer.cookie, method: 'POST', body: { id, disabled } })).status, 200)
    const result = await login('pending@test.local')
    assert.equal(result.status, 200)
    assert.equal(result.data.user.activated, false)
  })
  await t.test('trainer deletion removes client data and access, protects trainers, and keeps redeemed invites revoked', async () => {
    const id = client.data.user.id
    assert.equal((await request('/api/admin/user', { method: 'DELETE', body: { id } })).status, 401)
    assert.equal((await request('/api/admin/user', { cookie: client.cookie, method: 'DELETE', body: { id } })).status, 403)
    assert.equal((await request('/api/admin/user', { cookie: trainer.cookie, method: 'DELETE', body: { id: 'trainer' } })).status, 400)
    assert.equal((await request('/api/admin/user', { cookie: trainer.cookie, method: 'DELETE', body: {} })).status, 400)
    await pool.execute("INSERT INTO invites(code,used_by,used_at) VALUES ('DELETE-TEST',?,CURRENT_TIMESTAMP(3))", [id])
    await pool.execute("INSERT INTO push_subscriptions(user_id,endpoint_hash,endpoint,keys_json) VALUES (?,UNHEX(SHA2('test',256)),'https://push.invalid/test','{}')", [id])
    await pool.execute("INSERT INTO passkey_credentials(credential_id,user_id,public_key,counter,transports) VALUES ('delete-test',?,'unused',0,'[]')", [id])
    const deleted = await request('/api/admin/user', { cookie: trainer.cookie, method: 'DELETE', body: { id } })
    assert.equal(deleted.status, 200)
    for (const table of ['users', 'client_states', 'push_subscriptions', 'passkey_credentials']) {
      const [[row]] = await pool.execute(`SELECT COUNT(*) total FROM ${table} WHERE ${table === 'users' ? 'id' : 'user_id'}=?`, [id])
      assert.equal(row.total, 0, table)
    }
    const [[invite]] = await pool.query("SELECT used_by,revoked_at FROM invites WHERE code='DELETE-TEST'")
    assert.equal(invite.used_by, null)
    assert.ok(invite.revoked_at)
    assert.equal((await request('/api/me', { cookie: client.cookie })).status, 401)
    assert.equal((await login('new@test.local')).status, 401)
    assert.equal((await request('/api/admin/user?id=' + id, { cookie: trainer.cookie })).status, 404)
    assert.equal((await request('/api/admin/user', { cookie: trainer.cookie, method: 'DELETE', body: { id } })).status, 404)
    const listing = await request('/api/admin/users', { cookie: trainer.cookie })
    assert.ok(listing.data.users.some(u => u.id === 'trainer'))
    assert.ok(!listing.data.users.some(u => u.id === id))
  })

})
