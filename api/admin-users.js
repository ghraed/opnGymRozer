import crypto from 'node:crypto'
import { hashPassword } from './db.js'
import { ROLES } from './access.js'
import { profileComplete } from './profile.js'
import { parseJson } from './state.js'

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }) }
export function accountInput(body, { creating = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('account fields required')
  const input = {}
  if (creating || Object.hasOwn(body, 'name')) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 80) fail('name must be 1–80 characters')
    input.name = body.name.trim()
  }
  if (creating || Object.hasOwn(body, 'email')) {
    if (typeof body.email !== 'string') fail('valid email required')
    input.email = body.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 254) fail('valid email required')
  }
  if (creating || Object.hasOwn(body, 'password')) {
    if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 200) fail('password must be 8–200 characters')
    input.password_hash = hashPassword(body.password)
  }
  if (creating || Object.hasOwn(body, 'role')) {
    const role = body.role ?? (creating ? 'client' : null)
    if (!ROLES.includes(role)) fail('invalid role')
    input.role = role
  }
  for (const key of ['disabled', 'activated']) if (Object.hasOwn(body, key)) {
    if (typeof body[key] !== 'boolean') fail(key + ' must be true or false')
    input[key] = body[key]
  }
  if (Object.hasOwn(body, 'onboarding')) {
    if (!profileComplete(body.onboarding)) fail('Complete fitness profile required')
    input.onboarding = body.onboarding
  }
  if (Object.hasOwn(body, 'profileImage')) {
    if (body.profileImage !== null && (typeof body.profileImage !== 'string' || body.profileImage.length > 300000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(body.profileImage))) fail('Invalid profile photo')
    input.profileImage = body.profileImage
  }
  return input
}

// Serialize account mutations so concurrent demotions/deletions cannot remove
// the last enabled admin. Re-check the actor inside the same transaction.
export async function manageUser(pool, actor, body, action) {
  const fields = action === 'delete' ? {} : accountInput(body, { creating: action === 'create' })
  if (action !== 'create' && (typeof body.id !== 'string' || !body.id)) fail('user id required')
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [users] = await conn.query('SELECT id,role,disabled FROM users ORDER BY id FOR UPDATE')
    const currentActor = users.find(u => u.id === actor.id)
    if (!currentActor || currentActor.role !== 'admin' || currentActor.disabled) fail('admin access required', 403)
    const target = users.find(u => u.id === body.id)
    if (action !== 'create' && !target) fail('no such user', 404)
    if (target?.id === actor.id && (action === 'delete' || fields.disabled === true || (fields.role && fields.role !== 'admin'))) fail('cannot delete, disable or demote your own admin account')
    if (target?.role === 'admin' && !target.disabled && (action === 'delete' || fields.disabled === true || (fields.role && fields.role !== 'admin')) && users.filter(u => u.role === 'admin' && !u.disabled).length <= 1) fail('cannot remove the final enabled admin')
    const id = action === 'create' ? crypto.randomBytes(12).toString('base64url') : body.id
    const { onboarding, profileImage, ...columns } = fields
    if (action === 'create') {
      columns.activated ??= true
      await conn.execute(`INSERT INTO users(id,${Object.keys(columns).join(',')}) VALUES (${[id, ...Object.values(columns)].map(() => '?').join(',')})`, [id, ...Object.values(columns)])
      await conn.execute('INSERT INTO client_states(user_id,settings_json,plan_json,progress_json,plan_updated_by) VALUES (?,?,?,?,?)', [id, JSON.stringify({ ...(onboarding ? { onboarding } : {}), ...(profileImage !== undefined ? { profileImage } : {}) }), '{}', '{}', actor.id])
    } else if (action === 'delete') {
      await conn.execute('UPDATE invites SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP(3)) WHERE used_by=?', [id])
      await conn.execute('DELETE FROM users WHERE id=?', [id])
    } else {
      if (columns.role && columns.role !== 'client') columns.activated = true
      const entries = Object.entries(columns)
      // Invalidate existing sessions after identity, role or access changes.
      if (entries.length) await conn.execute(`UPDATE users SET ${entries.map(([key]) => key + '=?').join(',')},session_version=session_version+1 WHERE id=?`, [...entries.map(([, value]) => value), id])
      if (onboarding || profileImage !== undefined) {
        const [states] = await conn.execute('SELECT settings_json FROM client_states WHERE user_id=? FOR UPDATE', [id])
        const settings = { ...parseJson(states[0]?.settings_json), ...(onboarding ? { onboarding } : {}), ...(profileImage !== undefined ? { profileImage } : {}) }
        await conn.execute('INSERT INTO client_states(user_id,settings_json,plan_json,progress_json,plan_updated_by) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE settings_json=VALUES(settings_json)', [id, JSON.stringify(settings), '{}', '{}', actor.id])
      }
    }
    await conn.commit()
    return id
  } catch (error) {
    await conn.rollback()
    if (error.code === 'ER_DUP_ENTRY') fail('an account already exists for this email', 409)
    throw error
  } finally { conn.release() }
}
