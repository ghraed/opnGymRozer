import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, execFile } from 'node:child_process'
import { once } from 'node:events'
import { promisify } from 'node:util'
import { createPool, hashPassword, migrate } from '../db.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const retiredFeature = /\binvit(?:e|ation)[a-z_-]*\b/i
async function runtimeFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(entry => {
    const name = path.join(directory, entry.name)
    if (entry.isDirectory()) return ['test', 'migrations', 'node_modules'].includes(entry.name) ? [] : runtimeFiles(name)
    return /\.(?:js|jsx|css)$/.test(name) && !name.endsWith('.test.js') ? [name] : []
  }))
  return files.flat()
}

test('runtime code contains no invitation fields, routes, validation, settings or database access', async () => {
  const files = (await Promise.all(['api', 'frontend/src'].map(directory => runtimeFiles(path.join(root, directory))))).flat()
  assert.ok(files.length > 50, 'Scan the complete application, not just the registration form')
  const remaining = []
  for (const file of files) {
    const lines = (await fs.readFile(file, 'utf8')).split('\n')
    lines.forEach((line, index) => { if (retiredFeature.test(line)) remaining.push(path.relative(root, file) + ':' + (index + 1)) })
  }
  assert.deepEqual(remaining, [], 'Retired invitation functionality was reintroduced')
})

test('deployment examples and current documentation do not advertise invitation codes', async () => {
  // Historical migrations and release notes deliberately document older versions.
  for (const file of ['.env.example', 'docker-compose.yml', 'README.md', 'SECURITY.md', 'docs/SELF_HOSTING.md', 'website/docs.html']) {
    assert.doesNotMatch(await fs.readFile(path.join(root, file), 'utf8'), retiredFeature, file)
  }
})

const database = process.env.TEST_INVITATION_REMOVAL_DB_NAME
// Use a fresh, disposable database; never run schema-removal tests on application data.
test('invitation removal preserves accounts and coverage and retires the full HTTP contract', { skip: !database, timeout: 30000 }, async t => {
  assert.match(database, /^opengym_test_[a-z0-9_]+$/)
  const pool = createPool({ database })
  t.after(() => pool.end())
  assert.equal((await pool.query('SHOW TABLES'))[0].length, 0, 'Use an empty disposable database')
  await pool.query('CREATE TABLE schema_migrations (version VARCHAR(191) PRIMARY KEY)')
  const migrations = path.join(root, 'api/migrations')
  const removal = '011_remove_invitation_codes.sql'
  for (const file of (await fs.readdir(migrations)).filter(file => file.endsWith('.sql') && file < removal).sort()) {
    await pool.query(await fs.readFile(path.join(migrations, file), 'utf8'))
    await pool.execute('INSERT INTO schema_migrations(version) VALUES (?)', [file])
  }
  const password = 'InvitationRemovalTest2026!'
  for (const [id, role] of [['admin', 'admin'], ['trainer', 'trainer'], ['client', 'client']]) {
    await pool.execute('INSERT INTO users(id,name,email,password_hash,role,activated,invited_by) VALUES (?,?,?,?,?,TRUE,?)', [id, id, id + '@test.local', hashPassword(password), role, 'OLD-CODE'])
  }
  await pool.execute("INSERT INTO invites(code,created_by,used_by) VALUES ('OLD-CODE','trainer','client'),('UNUSED-CODE','admin',NULL)")
  const settings = JSON.stringify({ profileImage: 'data:image/jpeg;base64,/9j/2Q==' })
  await pool.execute("INSERT INTO client_states(user_id,settings_json,plan_json,progress_json) VALUES ('client',?,'{}','{}')", [settings])
  await pool.query("INSERT INTO membership_plans(id,name,duration_count,duration_unit,price,currency) VALUES ('plan','Monthly',1,'month',25,'USD')")
  await pool.query("INSERT INTO member_subscriptions(id,member_id,member_name,plan_id,plan_name,cycle,duration_count,duration_unit,starts_on,ends_on,price,currency,request_key,request_hash) VALUES ('term','client','client','plan','Monthly','monthly',1,'month','2090-01-01','2090-02-01',25,'USD','existing-request-key','existing-request-hash')")

  await t.test('upgrade removes used and unused codes while preserving account, profile and subscription data', async () => {
    await migrate(pool)
    assert.equal((await pool.query("SHOW TABLES LIKE 'invites'"))[0].length, 0)
    assert.equal((await pool.query("SHOW COLUMNS FROM users LIKE 'invited_by'"))[0].length, 0)
    assert.equal((await pool.query('SELECT id FROM users'))[0].length, 3)
    assert.ok((await pool.query('SELECT activated FROM users'))[0].every(user => user.activated === 1))
    const [[state]] = await pool.query("SELECT settings_json FROM client_states WHERE user_id='client'")
    assert.deepEqual(typeof state.settings_json === 'string' ? JSON.parse(state.settings_json) : state.settings_json, JSON.parse(settings))
    const [[term]] = await pool.query("SELECT price,ends_on FROM member_subscriptions WHERE id='term'")
    assert.equal(String(term.price), '25.00')
    assert.equal(term.ends_on.toISOString().slice(0, 10), '2090-02-01')
    await migrate(pool)
    // A retry must also work when MySQL committed DDL before the migration was marked complete.
    await pool.query(await fs.readFile(path.join(migrations, removal), 'utf8'))
  })

  const port = process.env.TEST_INVITATION_REMOVAL_API_PORT || '33029'
  const env = { ...process.env, DB_NAME: database, PORT: port, ORIGIN: 'http://localhost:' + port, SESSION_SECRET: 'invitation-removal-test', INVITE_ONLY: '1' }
  const child = spawn(process.execPath, ['server.js'], { cwd: path.join(root, 'api'), env, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', data => { output += data }); child.stderr.on('data', data => { output += data })
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, 'exit') } })
  for (let i = 0; !output.includes('gym-api on'); i++) {
    assert.ok(i < 100 && child.exitCode === null, output || 'API did not start')
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  const request = async (url, { cookie, method = 'GET', body } = {}) => {
    const response = await fetch('http://127.0.0.1:' + port + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
  }
  const cookies = {}
  for (const role of ['admin', 'trainer', 'client']) {
    const login = await request('/api/auth/login', { method: 'POST', body: { email: role + '@test.local', password } })
    assert.equal(login.status, 200)
    cookies[role] = login.cookie
  }
  await t.test('registration ignores obsolete codes and invite-only settings but still requires staff approval', async () => {
    for (const [email, extra] of [['no-code@test.local', {}], ['old-client@test.local', { code: 'INVALID-OR-REUSED', activated: true, role: 'admin' }]]) {
      const result = await request('/api/auth/register', { method: 'POST', body: { name: 'New member', email, password, ...extra } })
      assert.equal(result.status, 200, JSON.stringify(result.data))
      assert.equal(result.data.user.role, 'client')
      assert.equal(result.data.user.activated, false)
      assert.equal((await request('/api/data', { cookie: result.cookie })).data.code, 'ACCOUNT_PENDING')
    }
  })
  await t.test('removed endpoints return 404 for guests, clients, trainers and admins', async () => {
    for (const cookie of [undefined, ...Object.values(cookies)]) {
      for (const [url, method] of [['/api/config', 'GET'], ['/api/admin/invites', 'GET'], ['/api/admin/invites/new', 'POST'], ['/api/admin/invites/revoke', 'POST']]) {
        assert.equal((await request(url, { cookie, method, body: method === 'POST' ? { code: 'OLD-CODE' } : undefined })).status, 404, method + ' ' + url)
      }
    }
    const users = await request('/api/admin/users', { cookie: cookies.admin })
    assert.ok(!Object.hasOwn(users.data, 'invite_only'))
    const detail = await request('/api/admin/user?id=client', { cookie: cookies.admin })
    assert.ok(!Object.hasOwn(detail.data.user, 'invitedBy'))
  })
  await t.test('legacy JSON import ignores invitation archives and does not restore removed schema', async () => {
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'opengym-legacy-import-'))
    t.after(() => fs.rm(folder, { recursive: true, force: true }))
    await fs.writeFile(path.join(folder, 'db.json'), JSON.stringify({ users: [{ id: 'legacy', name: 'Legacy member', invitedBy: 'OLD-CODE' }], creds: [], invites: [{ code: 'ARCHIVED-CODE' }] }))
    const run = () => promisify(execFile)(process.execPath, ['scripts/import-json.js', '--data-dir=' + folder], { cwd: path.join(root, 'api'), env })
    assert.match((await run()).stdout, /Imported 1 users/)
    assert.match((await run()).stdout, /already applied/)
    assert.equal((await pool.query("SELECT id FROM users WHERE id='legacy'"))[0].length, 1)
    assert.equal((await pool.query("SHOW TABLES LIKE 'invites'"))[0].length, 0)
  })
})
