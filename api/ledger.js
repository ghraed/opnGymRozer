import { validDate } from './subscription-periods.js'

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }) }
const text = (value, max, label, optional = false) => {
  if (optional && value == null) return ''
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.trim().length > max) fail(`${label} must be ${optional ? '0' : '1'}–${max} characters`)
  return value.trim()
}
export function ledgerInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Entry fields required')
  if (!['revenue', 'expense'].includes(body.kind)) fail('Invalid entry type')
  if (!validDate(body.date)) fail('Choose a valid transaction date (year 2000 or later)')
  if (!['USD', 'LBP'].includes(body.currency)) fail('Currency must be USD or LBP')
  if (typeof body.amount !== 'string' || !/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(body.amount) || !/[1-9]/.test(body.amount)) fail('Amount must be greater than zero, at most 9999999999.99, with up to 2 decimal places')
  if (!['cash', 'card', 'transfer', 'other'].includes(body.method)) fail('Choose a payment method')
  if (typeof body.id !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(body.id)) fail('A unique entry ID is required')
  const [whole, fraction = ''] = body.amount.split('.')
  return { id: body.id, kind: body.kind, date: body.date, amount: `${whole}.${fraction.padEnd(2, '0')}`, currency: body.currency,
    category: text(body.category, 80, 'Category'), description: text(body.description, 500, 'Description'), reference: text(body.reference, 120, 'Reference', true), method: body.method }
}
export function ledgerPeriod(params) {
  const from = params.get('from'), to = params.get('to')
  if (!validDate(from) || !validDate(to) || from > to) fail('Choose a valid date range; start must be on or before end')
  return { from, to }
}
const publicEntry = r => ({ id: r.id, kind: r.kind, date: r.entry_date instanceof Date ? r.entry_date.toISOString().slice(0, 10) : r.entry_date, amount: String(r.amount), currency: r.currency, category: r.category, description: r.description, reference: r.reference, method: r.method, createdAt: r.created_at, createdBy: r.created_by, voidedAt: r.voided_at, voidedBy: r.voided_by, voidReason: r.void_reason, sourceSubscriptionId: r.source_subscription_id || null })
export async function writeLedger(pool, actor, body, action) {
  const fields = action === 'create' ? ledgerInput(body) : null
  if (action === 'void' && (typeof body?.id !== 'string' || body.id.length > 64)) fail('Entry ID required')
  const reason = action === 'void' ? text(body.reason, 500, 'Void reason') : null
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [[user]] = await conn.execute('SELECT role,disabled FROM users WHERE id=? FOR UPDATE', [actor.id])
    if (!user || user.role !== 'admin' || user.disabled) fail('Admin access required', 403)
    const id = fields?.id || body.id
    // Actor locking serializes retries from the same account; PK handles other actors.
    const [[existing]] = await conn.execute('SELECT * FROM finance_entries WHERE id=? FOR UPDATE', [id])
    let replayed = false
    if (action === 'create') {
      if (existing) {
        const previous = publicEntry(existing)
        if (existing.created_by !== actor.id || Object.keys(fields).some(k => previous[k] !== fields[k])) fail('Entry ID already used. Open a new entry.', 409)
        replayed = true
      } else {
        await conn.execute('INSERT INTO finance_entries(id,kind,entry_date,amount,currency,category,description,reference,method,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)', [id, fields.kind, fields.date, fields.amount, fields.currency, fields.category, fields.description, fields.reference, fields.method, actor.id])
      }
    } else {
      if (!existing) fail('Entry not found', 404)
      if (existing.source_subscription_id) fail('Correct the payment status in the renewal tracker to void linked revenue.', 409)
      if (existing.voided_at) fail('Entry is already voided', 409)
      await conn.execute('UPDATE finance_entries SET voided_at=CURRENT_TIMESTAMP(3),voided_by=?,void_reason=? WHERE id=?', [actor.id, reason, id])
    }
    const [[row]] = await conn.execute('SELECT * FROM finance_entries WHERE id=?', [id])
    await conn.commit()
    return { entry: publicEntry(row), replayed }
  } catch (error) { await conn.rollback(); if (error.code === 'ER_DUP_ENTRY' || error.code === 'ER_LOCK_DEADLOCK') fail('Concurrent entry change. Retry with the same entry ID.', 409); throw error } finally { conn.release() }
}
export async function listLedger(pool, params) {
  const { from, to } = ledgerPeriod(params)
  const kind = params.get('kind'), currency = params.get('currency') || 'all', status = params.get('status') || 'posted'
  const page = Number(params.get('page') || 1)
  if (!['revenue', 'expense'].includes(kind) || !['USD', 'LBP', 'all'].includes(currency) || !['posted', 'voided', 'all'].includes(status) || !Number.isSafeInteger(page) || page < 1 || page > 1000000) fail('Invalid ledger filters')
  const where = `kind=? AND entry_date BETWEEN ? AND ?${currency === 'all' ? '' : ' AND currency=?'}${status === 'all' ? '' : ` AND voided_at IS ${status === 'posted' ? '' : 'NOT '}NULL`}`
  const args = [kind, from, to, ...(currency === 'all' ? [] : [currency])]
  const [[count]] = await pool.execute(`SELECT COUNT(*) AS total FROM finance_entries WHERE ${where}`, args)
  const [rows] = await pool.query(`SELECT * FROM finance_entries WHERE ${where} ORDER BY entry_date DESC,created_at DESC,id LIMIT 50 OFFSET ?`, [...args, (page - 1) * 50])
  return { entries: rows.map(publicEntry), total: Number(count.total), page, pageSize: 50 }
}
// BigInt keeps aggregates exact even when many maximum-value entries exceed Number precision.
const cents = value => BigInt(String(value).replace('.', ''))
const money = value => `${value < 0n ? '-' : ''}${(value < 0n ? -value : value) / 100n}.${String((value < 0n ? -value : value) % 100n).padStart(2, '0')}`
export function summarizeLedger(groups) {
  return ['USD', 'LBP'].map(currency => {
    const rows = groups.filter(g => g.currency === currency)
    const sum = kind => rows.filter(r => r.kind === kind).reduce((n, r) => n + cents(r.total), 0n)
    const revenue = sum('revenue'), expenses = sum('expense')
    const months = [...new Set(rows.map(r => r.month))].sort().map(month => {
      const sumMonth = kind => rows.filter(r => r.month === month && r.kind === kind).reduce((n, r) => n + cents(r.total), 0n)
      const income = sumMonth('revenue'), cost = sumMonth('expense')
      return { month, revenue: money(income), expenses: money(cost), profit: money(income - cost) }
    })
    return { currency, revenue: money(revenue), expenses: money(expenses), profit: money(revenue - expenses), months,
      categories: ['revenue', 'expense'].flatMap(kind => [...new Set(rows.filter(r => r.kind === kind).map(r => r.category))].sort().map(category => ({ kind, category, total: money(rows.filter(r => r.kind === kind && r.category === category).reduce((n, r) => n + cents(r.total), 0n)) }))) }
  })
}
export async function ledgerReport(pool, params) {
  const { from, to } = ledgerPeriod(params)
  const [groups] = await pool.execute("SELECT currency,kind,category,DATE_FORMAT(entry_date,'%Y-%m') AS month,SUM(amount) AS total FROM finance_entries WHERE voided_at IS NULL AND entry_date BETWEEN ? AND ? GROUP BY currency,kind,category,DATE_FORMAT(entry_date,'%Y-%m')", [from, to])
  return { from, to, basis: 'cash', currencies: summarizeLedger(groups) }
}
