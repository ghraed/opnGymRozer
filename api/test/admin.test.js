import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createPool, hashPassword, migrate } from '../db.js'
import { accountInput } from '../admin-users.js'
import { publicUser, canViewUser } from '../access.js'

test('admin and trainer are distinct roles; account input rejects privilege and malformed values', () => {
  assert.equal(publicUser({ id: 'a', role: 'admin' }).admin, true)
  assert.equal(publicUser({ id: 't', role: 'trainer' }).role, 'trainer')
  assert.equal(canViewUser({ role: 'trainer' }, { role: 'admin' }), false)
  assert.equal(canViewUser({ role: 'trainer' }, { role: 'trainer' }), false)
  assert.equal(canViewUser({ role: 'admin' }, { role: 'trainer' }), true)
  for (const value of [{ role: 'owner' }, { role: null }, { email: 'bad' }, { password: 'short' }, { disabled: 'false' }, { activated: 1 }, { name: ' ' }, { name: 'x'.repeat(81) }, { onboarding: {} }, { profileImage: 'data:image/svg+xml;base64,ABC=' }]) {
    assert.throws(() => accountInput(value), { status: 400 })
  }
  assert.deepEqual(accountInput({ name: ' Name ', email: 'A@EXAMPLE.COM', admin: true, session_version: 0 }), { name: 'Name', email: 'a@example.com' })
})

const database = process.env.TEST_ADMIN_DB_NAME
// Empty, separate database required; never runs against application data.
test('admin manages every role while trainers and clients cannot manage staff', { skip: !database, timeout: 30000 }, async t => {
  assert.match(database, /^opengym_test_[a-z0-9_]+$/)
  const pool = createPool({ database })
  t.after(() => pool.end())
  const [tables] = await pool.query('SHOW TABLES')
  assert.equal(tables.length, 0, 'Use an empty disposable database')
  await migrate(pool)
  await migrate(pool)
  const password = 'AdminTestPassword2026!'
  const profile = { goal: 'muscle', currentWeight: 80, height: 175, days: 3, experience: 'beginner', equipment: 'full_gym', body: 'none', completedAt: 123 }
  for (const [id, role] of [['admin', 'admin'], ['second', 'admin'], ['trainer', 'trainer'], ['client', 'client']]) {
    await pool.execute('INSERT INTO users(id,name,email,password_hash,role,activated) VALUES (?,?,?,?,?,TRUE)', [id, id, id + '@test.local', hashPassword(password), role])
    await pool.execute('INSERT INTO client_states(user_id,settings_json,plan_json,progress_json) VALUES (?,?,?,?)', [id, JSON.stringify({ onboarding: profile }), '{}', '{}'])
  }
  const port = process.env.TEST_ADMIN_API_PORT || '33020'
  const child = spawn(process.execPath, ['server.js'], { cwd: new URL('../', import.meta.url), env: { ...process.env, DB_NAME: database, PORT: port, ORIGIN: 'http://localhost:' + port, SESSION_SECRET: 'admin-test-secret' }, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', d => { output += d }); child.stderr.on('data', d => { output += d })
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, 'exit') } })
  for (let i = 0; !output.includes('gym-api on'); i++) { assert.ok(i < 100 && child.exitCode === null, output); await new Promise(r => setTimeout(r, 50)) }
  const request = async (path, { cookie, method = 'GET', body } = {}) => {
    const response = await fetch('http://127.0.0.1:' + port + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
  }
  const login = (email, pass = password) => request('/api/auth/login', { method: 'POST', body: { email, password: pass } })
  let admin = await login('admin@test.local')
  const trainer = await login('trainer@test.local'), client = await login('client@test.local')
  const mutate = (path, body, method = 'POST', cookie = admin.cookie) => request(path, { method, cookie, body })
  await t.test('admin sees trainers, all profiles and emails; trainer sees only clients', async () => {
    const all = await request('/api/admin/users', { cookie: admin.cookie })
    assert.equal(all.status, 200); assert.equal(all.data.users.length, 4)
    assert.ok(all.data.users.every(u => u.email && !u.password_hash))
    for (const id of ['admin', 'trainer', 'client']) {
      const detail = await request('/api/admin/user?id=' + id, { cookie: admin.cookie })
      assert.equal(detail.status, 200); assert.deepEqual(detail.data.onboarding, profile)
    }
    const clients = await request('/api/admin/users', { cookie: trainer.cookie })
    assert.deepEqual(clients.data.users.map(u => u.id), ['client'])
    for (const id of ['admin', 'trainer']) for (const path of ['/api/admin/user?id=', '/api/admin/client/state?id=']) assert.equal((await request(path + id, { cookie: trainer.cookie })).status, 404)
  })
  await t.test('public registration cannot choose its role; no unauthorized CRUD or promotion', async () => {
    const registered = await request('/api/auth/register', { method: 'POST', body: { name: 'Public', email: 'public@test.local', password, role: 'admin', admin: true, activated: true } })
    assert.equal(registered.data.user.role, 'client'); assert.equal(registered.data.user.activated, false)
    for (const cookie of [undefined, trainer.cookie, client.cookie]) {
      for (const [path, method, body] of [['/api/admin/users', 'POST', { name: 'No', email: 'no@test.local', password, role: 'admin' }], ['/api/admin/user', 'PUT', { id: 'trainer', role: 'admin' }], ['/api/admin/user/role', 'POST', { id: 'client', role: 'admin' }]]) {
        assert.equal((await request(path, { cookie, method, body })).status, cookie ? 403 : 401)
      }
    }
    assert.equal((await mutate('/api/admin/client/plan', { id: 'admin', plan: {}, baseVersion: 0 }, 'PUT', trainer.cookie)).status, 404)
    assert.equal((await mutate('/api/admin/user', { id: 'admin' }, 'DELETE', trainer.cookie)).status, 400)
  })
  let createdId
  await t.test('admin creates every role with hashed passwords and initialized profiles', async () => {
    for (const role of ['client', 'trainer', 'admin']) {
      const created = await mutate('/api/admin/users', { name: 'Created ' + role, email: role + 'new@test.local', password, role })
      assert.equal(created.status, 201, JSON.stringify(created.data))
      assert.equal(created.data.user.role, role); assert.equal(created.data.user.activated, true)
      const logged = await login(role + 'new@test.local')
      assert.equal(logged.status, 200)
      assert.equal((await request('/api/data', { cookie: logged.cookie })).status, 200)
      if (role === 'trainer') createdId = created.data.user.id
    }
    assert.equal((await mutate('/api/admin/users', { name: 'Duplicate', email: 'trainernew@test.local', password })).status, 409)
    assert.equal((await mutate('/api/admin/users', { name: 'Bad role', email: 'bad@test.local', password, role: 'owner' })).status, 400)
    assert.equal((await mutate('/api/admin/user', { id: 'trainer', password: 'short' }, 'PUT')).status, 400)
  })
  await t.test('admin edits trainer identity, photo, profile and plan, revoking old sessions', async () => {
    const photo = 'data:image/jpeg;base64,/9j/2Q=='
    const changed = await mutate('/api/admin/user', { id: 'trainer', name: 'Updated trainer', email: 'updated@test.local', password: 'ChangedPassword2026!', onboarding: { ...profile, height: 180 }, profileImage: photo }, 'PUT')
    assert.equal(changed.status, 200, JSON.stringify(changed.data))
    assert.equal((await request('/api/me', { cookie: trainer.cookie })).status, 401)
    assert.equal((await login('trainer@test.local')).status, 401)
    assert.equal((await login('updated@test.local', 'ChangedPassword2026!')).status, 200)
    const detail = await request('/api/admin/user?id=trainer', { cookie: admin.cookie })
    assert.equal(detail.data.onboarding.height, 180); assert.equal(detail.data.profileImage, photo)
    assert.equal((await mutate('/api/admin/client/plan', { id: 'trainer', plan: { routines: [] }, baseVersion: detail.data.revisions.plan }, 'PUT')).status, 200)
    assert.equal((await mutate('/api/admin/user', { id: 'trainer', email: 'client@test.local' }, 'PUT')).status, 409)
  })
  await t.test('admin can suspend, restore, promote and delete trainers with cascading data cleanup', async () => {
    const logged = await login('trainernew@test.local')
    assert.equal((await mutate('/api/admin/user/disable', { id: createdId, disabled: true })).status, 200)
    assert.equal((await request('/api/me', { cookie: logged.cookie })).status, 401)
    assert.equal((await login('trainernew@test.local')).status, 403)
    assert.equal((await mutate('/api/admin/user/disable', { id: createdId, disabled: false })).status, 200)
    assert.equal((await request('/api/me', { cookie: logged.cookie })).status, 401)
    assert.equal((await mutate('/api/admin/user/role', { id: createdId, role: 'admin' })).status, 200)
    assert.equal((await login('trainernew@test.local')).data.user.role, 'admin')
    assert.equal((await mutate('/api/admin/user', { id: createdId }, 'DELETE')).status, 200)
    const [[state]] = await pool.execute('SELECT COUNT(*) total FROM client_states WHERE user_id=?', [createdId])
    assert.equal(state.total, 0)
    assert.equal((await mutate('/api/admin/user', { id: createdId }, 'DELETE')).status, 404)
  })
  await t.test('admin self edits keep a valid session; self deletion, disable and demotion are blocked', async () => {
    for (const [path, method, body] of [['/api/admin/user', 'DELETE', { id: 'admin' }], ['/api/admin/user/disable', 'POST', { id: 'admin', disabled: true }], ['/api/admin/user/role', 'POST', { id: 'admin', role: 'trainer' }]]) assert.equal((await mutate(path, body, method)).status, 400)
    const edited = await mutate('/api/admin/user', { id: 'admin', name: 'Owner' }, 'PUT')
    assert.equal(edited.status, 200); assert.ok(edited.cookie)
    assert.equal((await request('/api/me', { cookie: admin.cookie })).status, 401)
    admin.cookie = edited.cookie
    assert.equal((await request('/api/me', { cookie: admin.cookie })).status, 200)
  })
  await t.test('concurrent cross-demotions cannot remove every enabled admin', async () => {
    const [extras] = await pool.query("SELECT id FROM users WHERE role='admin' AND id NOT IN ('admin','second')")
    for (const extra of extras) assert.equal((await mutate('/api/admin/user', { id: extra.id }, 'DELETE')).status, 200)
    const second = await login('second@test.local')
    const results = await Promise.all([mutate('/api/admin/user/role', { id: 'second', role: 'client' }), mutate('/api/admin/user/role', { id: 'admin', role: 'client' }, 'POST', second.cookie)])
    assert.equal(results.filter(r => r.status === 200).length, 1)
    const [[row]] = await pool.query("SELECT COUNT(*) total FROM users WHERE role='admin' AND disabled=0")
    assert.equal(row.total, 1)
  })
})
