import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createPool, migrate } from '../db.js'
import { splitState } from '../state.js'

const arg = process.argv.find(a => a.startsWith('--data-dir='))
const dataDir = path.resolve(arg ? arg.slice('--data-dir='.length) : path.join(process.cwd(), '..', 'data'))
const dbPath = path.join(dataDir, 'db.json')
if (!fs.existsSync(dbPath)) throw new Error(`missing ${dbPath}`)
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
for (const key of ['users', 'creds']) if (!Array.isArray(db[key])) throw new Error(`db.json: ${key} must be an array`)
const states = new Map()
for (const user of db.users) {
  const file = path.join(dataDir, `state-${user.id}.json`)
  states.set(user.id, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {})
}
const importKey = 'json-v1:' + crypto.createHash('sha256').update(fs.readFileSync(dbPath)).digest('hex')
const pool = createPool()
await migrate(pool)
const [done] = await pool.execute('SELECT 1 FROM import_runs WHERE import_key=?', [importKey])
if (done.length) { console.log('JSON import already applied'); await pool.end(); process.exit(0) }
const conn = await pool.getConnection()
try {
  await conn.beginTransaction()
  for (const user of db.users) {
    await conn.execute(`INSERT INTO users(id,name,role,disabled,session_version,invited_by,created_at,last_reminder_date)
      VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)`,
      [user.id, user.name, user.admin ? 'trainer' : 'client', !!user.disabled, user.sv || 0, user.invitedBy || null, user.created ? new Date(user.created) : new Date(), user.lastReminder || null])
  }
  for (const cred of db.creds) await conn.execute(`INSERT INTO passkey_credentials(credential_id,user_id,public_key,counter,transports)
    VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE counter=VALUES(counter)`, [cred.id, cred.userId, cred.publicKey, cred.counter || 0, JSON.stringify(cred.transports || [])])
  for (const sub of db.subs || []) await conn.execute(`INSERT INTO push_subscriptions(user_id,endpoint_hash,endpoint,keys_json,created_at)
    VALUES (?,UNHEX(SHA2(?,256)),?,?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),keys_json=VALUES(keys_json)`,
    [sub.userId, sub.endpoint, sub.endpoint, JSON.stringify(sub.keys), sub.created ? new Date(sub.created) : new Date()])
  for (const invite of db.invites || []) await conn.execute(`INSERT INTO invites(code,note,created_by,used_by,created_at,used_at,revoked_at)
    VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE note=VALUES(note)`, [invite.code, invite.note || '', invite.createdBy || null, invite.usedBy || null, invite.created ? new Date(invite.created) : new Date(), invite.usedAt ? new Date(invite.usedAt) : null, invite.revoked ? new Date() : null])
  for (const [userId, state] of states) {
    const parts = splitState(state)
    await conn.execute(`INSERT INTO client_states(user_id,settings_json,plan_json,progress_json,plan_version,progress_version,plan_updated_by,client_timestamp)
      VALUES (?,?,?,?,1,1,?,?) ON DUPLICATE KEY UPDATE user_id=user_id`, [userId, JSON.stringify(parts.settings), JSON.stringify(parts.plan), JSON.stringify(parts.progress), userId, parts.clientTimestamp])
  }
  const secretFile = path.join(dataDir, 'secret')
  if (fs.existsSync(secretFile)) await conn.execute(`INSERT INTO app_settings(setting_key,value_json) VALUES ('session_secret',?) ON DUPLICATE KEY UPDATE setting_key=setting_key`, [JSON.stringify(fs.readFileSync(secretFile, 'utf8').trim())])
  const vapidFile = path.join(dataDir, 'vapid.json')
  if (fs.existsSync(vapidFile)) await conn.execute(`INSERT INTO app_settings(setting_key,value_json) VALUES ('vapid',?) ON DUPLICATE KEY UPDATE setting_key=setting_key`, [JSON.stringify(JSON.parse(fs.readFileSync(vapidFile, 'utf8')))])
  await conn.execute('INSERT INTO import_runs(import_key,details_json) VALUES (?,?)', [importKey, JSON.stringify({ dataDir, users: db.users.length, importedAt: new Date().toISOString() })])
  await conn.commit()
  console.log(`Imported ${db.users.length} users from ${dataDir}; source files were not changed`)
} catch (error) { await conn.rollback(); throw error }
finally { conn.release(); await pool.end() }
