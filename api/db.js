import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import crypto from 'node:crypto'
import { joinState, mergeProgress, parseJson, sameJson, splitState } from './state.js'

const here = path.dirname(fileURLToPath(import.meta.url))

export function createPool(overrides = {}) {
  return mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: +(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || 'opengym',
    user: process.env.DB_USER || 'opengym',
    password: process.env.DB_PASSWORD || 'opengym',
    waitForConnections: true,
    connectionLimit: +(process.env.DB_POOL_SIZE || 10),
    timezone: 'Z', charset: 'utf8mb4', multipleStatements: true,
    ...overrides
  })
}

export async function migrate(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(191) PRIMARY KEY,
    applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  const dir = path.join(here, 'migrations')
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    const [seen] = await pool.execute('SELECT 1 FROM schema_migrations WHERE version=?', [file])
    if (seen.length) continue
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query(fs.readFileSync(path.join(dir, file), 'utf8'))
      await conn.execute('INSERT INTO schema_migrations(version) VALUES (?)', [file])
      await conn.commit()
    } catch (error) { await conn.rollback(); throw error } finally { conn.release() }
  }
}

export async function setting(pool, key, factory) {
  const [rows] = await pool.execute('SELECT value_json FROM app_settings WHERE setting_key=?', [key])
  if (rows.length) {
    // mysql2 returns JSON scalar strings already unquoted. Those are valid setting
    // values (notably the session HMAC secret), but `parseJson()` quite rightly
    // treats non-JSON text as invalid and returns its object fallback.
    const value = rows[0].value_json
    if (typeof value !== 'string') return value
    try { return JSON.parse(value) } catch { return value }
  }
  const value = await factory()
  await pool.execute('INSERT INTO app_settings(setting_key,value_json) VALUES (?,?)', [key, JSON.stringify(value)])
  return value
}

export async function getUser(pool, id) {
  const [rows] = await pool.execute('SELECT * FROM users WHERE id=?', [id])
  return rows[0] || null
}

export async function getUserByEmail(pool, email) {
  const [rows] = await pool.execute('SELECT * FROM users WHERE email=?', [email])
  return rows[0] || null
}

export function hashPassword(password, salt = crypto.randomBytes(16)) {
  const derived = crypto.scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`
}

export async function createPasswordUser(pool, user, inviteCode = null) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    let invite = null
    if (inviteCode) {
      const [rows] = await conn.execute('SELECT * FROM invites WHERE code=? AND used_by IS NULL AND revoked_at IS NULL FOR UPDATE', [inviteCode])
      invite = rows[0]
      if (!invite) throw Object.assign(new Error('invite code is no longer valid — ask for a new one'), { status: 403 })
    }
    await conn.execute('INSERT INTO users(id,name,email,password_hash,invited_by,created_at) VALUES (?,?,?,?,?,?)', [user.id, user.name, user.email, user.passwordHash, inviteCode, user.created])
    await conn.execute('INSERT INTO client_states(user_id,settings_json,plan_json,progress_json,plan_updated_by) VALUES (?,?,?,?,?)', [user.id, '{}', '{}', '{}', user.id])
    if (invite) await conn.execute('UPDATE invites SET used_by=?,used_at=? WHERE code=?', [user.id, user.created, inviteCode])
    await conn.commit()
  } catch (error) { await conn.rollback(); throw error } finally { conn.release() }
}

export async function readClientState(pool, userId) {
  const [rows] = await pool.execute('SELECT * FROM client_states WHERE user_id=?', [userId])
  const row = rows[0]
  return row ? { state: joinState(row), revisions: { plan: Number(row.plan_version), progress: Number(row.progress_version) }, planWriterRole: row.plan_updated_by_role } : { state: null, revisions: { plan: 0, progress: 0 }, planWriterRole: 'client' }
}

export async function saveClientState(pool, actor, state, revisions = {}) {
  const incoming = splitState(state)
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.execute('SELECT * FROM client_states WHERE user_id=? FOR UPDATE', [actor.id])
    let row = rows[0]
    if (!row) {
      await conn.execute('INSERT INTO client_states(user_id,settings_json,plan_json,progress_json,plan_updated_by) VALUES (?,?,?,?,?)', [actor.id, '{}', '{}', '{}', actor.id])
      ;[row] = (await conn.execute('SELECT * FROM client_states WHERE user_id=? FOR UPDATE', [actor.id]))[0]
    }
    const currentPlan = parseJson(row.plan_json)
    const currentProgress = parseJson(row.progress_json)
    const planChanged = !sameJson(currentPlan, incoming.plan)
    const stalePlan = Number(revisions.plan ?? row.plan_version) !== Number(row.plan_version)
    const planConflict = planChanged && stalePlan
    const nextPlan = planConflict ? currentPlan : incoming.plan
    const nextProgress = Number(revisions.progress ?? row.progress_version) === Number(row.progress_version)
      ? incoming.progress : mergeProgress(currentProgress, incoming.progress)
    const nextPlanVersion = Number(row.plan_version) + (planChanged && !planConflict ? 1 : 0)
    const nextProgressVersion = Number(row.progress_version) + (!sameJson(currentProgress, nextProgress) ? 1 : 0)
    await conn.execute(`UPDATE client_states SET settings_json=?,plan_json=?,progress_json=?,plan_version=?,progress_version=?,
      plan_updated_by=IF(?, ?, plan_updated_by),plan_updated_by_role=IF(?, 'client', plan_updated_by_role),
      client_timestamp=?,plan_updated_at=IF(?,CURRENT_TIMESTAMP(3),plan_updated_at),progress_updated_at=CURRENT_TIMESTAMP(3) WHERE user_id=?`,
      [JSON.stringify(incoming.settings), JSON.stringify(nextPlan), JSON.stringify(nextProgress), nextPlanVersion, nextProgressVersion,
        planChanged && !planConflict, actor.id, planChanged && !planConflict, incoming.clientTimestamp, planChanged && !planConflict, actor.id])
    await conn.commit()
    const result = await readClientState(pool, actor.id)
    return { ...result, conflicts: planConflict ? ['plan'] : [] }
  } catch (error) { await conn.rollback(); throw error } finally { conn.release() }
}

export async function saveTrainerPlan(pool, trainer, clientId, plan, baseVersion) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.execute('SELECT * FROM client_states WHERE user_id=? FOR UPDATE', [clientId])
    if (!rows.length) throw Object.assign(new Error('no such client state'), { status: 404 })
    const row = rows[0]
    const stale = Number(baseVersion) !== Number(row.plan_version)
    if (stale && row.plan_updated_by_role === 'trainer') throw Object.assign(new Error('plan changed by another trainer — reload first'), { status: 409, currentVersion: Number(row.plan_version) })
    await conn.execute(`UPDATE client_states SET plan_json=?,plan_version=plan_version+1,plan_updated_by=?,
      plan_updated_by_role='trainer',plan_updated_at=CURRENT_TIMESTAMP(3) WHERE user_id=?`, [JSON.stringify(plan || {}), trainer.id, clientId])
    await conn.commit()
    return readClientState(pool, clientId)
  } catch (error) { await conn.rollback(); throw error } finally { conn.release() }
}
