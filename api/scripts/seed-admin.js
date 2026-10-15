import crypto from 'node:crypto'
import { createPool, hashPassword, migrate } from '../db.js'

// Server-side bootstrap only. Public registration can never choose a staff role.
const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD || undefined
const name = String(process.env.ADMIN_NAME || 'Administrator').trim()
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('ADMIN_EMAIL is required')
if (!name || name.length > 80) throw new Error('ADMIN_NAME must be 1–80 characters')
if (password !== undefined && (password.length < 8 || password.length > 200)) throw new Error('ADMIN_PASSWORD must be 8–200 characters')
const pool = createPool()
try {
  await migrate(pool)
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.execute('SELECT id FROM users WHERE email=? FOR UPDATE', [email])
    if (rows.length) {
      // Preserve the existing profile and password unless a replacement is supplied.
      await conn.execute(`UPDATE users SET role='admin',activated=TRUE,disabled=FALSE,session_version=session_version+1${password ? ',password_hash=?' : ''} WHERE id=?`, [...(password ? [hashPassword(password)] : []), rows[0].id])
    } else {
      if (!password) throw new Error('ADMIN_PASSWORD is required when creating a new admin')
      const id = crypto.randomBytes(12).toString('base64url')
      await conn.execute("INSERT INTO users(id,name,email,password_hash,role,activated) VALUES (?,?,?,?,'admin',TRUE)", [id, name, email, hashPassword(password)])
      await conn.execute('INSERT INTO client_states(user_id,settings_json,plan_json,progress_json,plan_updated_by) VALUES (?,?,?,?,?)', [id, '{}', '{}', '{}', id])
    }
    await conn.commit()
    console.log('Admin account ready: ' + email)
  } catch (error) { await conn.rollback(); throw error } finally { conn.release() }
} finally { await pool.end() }
