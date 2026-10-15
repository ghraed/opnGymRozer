import crypto from 'node:crypto'

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }) }
const objectBody = body => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('plan fields required')
}

// Normalize decimal money as text, without rounding through floating-point math.
// The DB uses DECIMAL(12,2); the API always returns two decimal places as a string.
export function planInput(body) {
  objectBody(body)
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 80) fail('name must be 1–80 characters')
  const description = body.description ?? ''
  if (typeof description !== 'string' || description.trim().length > 2000) fail('description must be at most 2000 characters')
  if (!Number.isInteger(body.durationCount) || body.durationCount < 1 || body.durationCount > 3650) fail('duration must be 1–3650 whole units')
  if (!['day', 'week', 'month', 'year'].includes(body.durationUnit)) fail('invalid duration unit')
  if (!['USD', 'LBP'].includes(body.currency)) fail('currency must be USD or LBP')
  const price = typeof body.price === 'string' ? body.price.trim() : typeof body.price === 'number' ? String(body.price) : ''
  if (!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(price)) fail('price must be a nonnegative amount with at most 2 decimal places (maximum 9999999999.99)')
  const [whole, fraction = ''] = price.split('.')
  return { name: body.name.trim(), description: description.trim(), durationCount: body.durationCount,
    durationUnit: body.durationUnit, currency: body.currency, price: whole + '.' + fraction.padEnd(2, '0') }
}

const publicPlan = row => ({ id: row.id, name: row.name, description: row.description,
  durationCount: Number(row.duration_count), durationUnit: row.duration_unit,
  price: String(row.price), currency: row.currency, active: !!row.active,
  version: Number(row.version), createdAt: row.created_at, updatedAt: row.updated_at })

export async function listMembershipPlans(pool) {
  const [rows] = await pool.query('SELECT * FROM membership_plans ORDER BY active DESC,name,id')
  return rows.map(publicPlan)
}

export async function writeMembershipPlan(pool, actor, body, action) {
  objectBody(body)
  const fields = action === 'status' ? null : planInput(body)
  if (action !== 'create') {
    if (typeof body.id !== 'string' || !body.id || body.id.length > 64) fail('plan id required')
    if (!Number.isInteger(body.version) || body.version < 1) fail('current plan version required')
  }
  if (action === 'status' && typeof body.active !== 'boolean') fail('active must be true or false')
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    // Lock the actor to prevent a simultaneous suspension or demotion from
    // committing while this privileged action is being authorized.
    const [actors] = await conn.execute('SELECT role,disabled FROM users WHERE id=? FOR UPDATE', [actor.id])
    if (!actors[0] || actors[0].role !== 'admin' || actors[0].disabled) fail('admin access required', 403)
    const id = action === 'create' ? crypto.randomBytes(12).toString('base64url') : body.id
    if (action !== 'create') {
      const [rows] = await conn.execute('SELECT version FROM membership_plans WHERE id=? FOR UPDATE', [id])
      if (!rows.length) fail('membership plan not found', 404)
      if (Number(rows[0].version) !== body.version) fail('This plan changed. Cancel and reopen it to load the latest version.', 409)
    }
    if (action === 'create') {
      await conn.execute('INSERT INTO membership_plans(id,name,description,duration_count,duration_unit,price,currency,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?)',
        [id, fields.name, fields.description, fields.durationCount, fields.durationUnit, fields.price, fields.currency, actor.id, actor.id])
    } else if (action === 'status') {
      await conn.execute('UPDATE membership_plans SET active=?,version=version+1,updated_by=? WHERE id=?', [body.active, actor.id, id])
    } else {
      await conn.execute('UPDATE membership_plans SET name=?,description=?,duration_count=?,duration_unit=?,price=?,currency=?,version=version+1,updated_by=? WHERE id=?',
        [fields.name, fields.description, fields.durationCount, fields.durationUnit, fields.price, fields.currency, actor.id, id])
    }
    const [[row]] = await conn.execute('SELECT * FROM membership_plans WHERE id=?', [id])
    await conn.commit()
    return publicPlan(row)
  } catch (error) { await conn.rollback(); throw error } finally { conn.release() }
}
