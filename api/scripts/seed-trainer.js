import crypto from 'node:crypto'
import { createPool, hashPassword, migrate } from '../db.js'

const email = String(process.env.TRAINER_EMAIL || 'trainer@rozer.pro').trim().toLowerCase()
const password = String(process.env.TRAINER_PASSWORD || 'trainer@rozer.pro')
const name = String(process.env.TRAINER_NAME || 'ROZER Trainer').trim().slice(0, 80)

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('TRAINER_EMAIL must be a valid email address')
if (password.length < 8 || password.length > 200) throw new Error('TRAINER_PASSWORD must be 8–200 characters')
if (!name) throw new Error('TRAINER_NAME is required')

const pool = createPool()
await migrate(pool)
const conn = await pool.getConnection()
try {
  await conn.beginTransaction()
  const [rows] = await conn.execute('SELECT id FROM users WHERE email=? FOR UPDATE', [email])
  let id
  if (rows.length) {
    id = rows[0].id
    await conn.execute('UPDATE users SET name=?,role=\'trainer\',disabled=FALSE,password_hash=?,session_version=session_version+1 WHERE id=?', [name, hashPassword(password), id])
  } else {
    id = crypto.randomBytes(12).toString('base64url')
    await conn.execute('INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,\'trainer\',?)', [id, name, email, hashPassword(password), new Date()])
    await conn.execute('INSERT INTO client_states(user_id,settings_json,plan_json,progress_json,plan_updated_by) VALUES (?,?,?,?,?)', [id, '{}', '{}', '{}', id])
  }
  await conn.commit()
  console.log(`Trainer account ready: ${email}`)
} catch (error) {
  await conn.rollback()
  throw error
} finally {
  conn.release()
  await pool.end()
}
