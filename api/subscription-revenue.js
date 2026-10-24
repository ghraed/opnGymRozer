import crypto from 'node:crypto'
import { financeToday } from './subscriptions.js'

// Caller holds the subscription lock and transaction. Never overwrite a receipt.
export async function syncSubscriptionRevenue(conn, row, actorId, status, date, method, note) {
  const [entries] = await conn.execute('SELECT * FROM finance_entries WHERE source_subscription_id=? AND voided_at IS NULL FOR UPDATE', [row.id])
  if (status !== 'paid') {
    await conn.execute("UPDATE finance_entries SET voided_at=CURRENT_TIMESTAMP(3),voided_by=?,void_reason=? WHERE source_subscription_id=? AND voided_at IS NULL", [actorId, ('Payment review corrected: ' + note).slice(0,500), row.id])
    return
  }
  if (entries.length || Number(row.price) === 0) return
  await conn.execute('INSERT INTO finance_entries(id,kind,entry_date,amount,currency,category,description,reference,method,created_by,source_subscription_id) VALUES (?,\'revenue\',?,?,?,\'Memberships\',?,?,?,?,?)',
    [crypto.randomUUID(), date, row.price, row.currency, `${row.member_name} · ${row.plan_name}`.slice(0,500), 'Subscription ' + row.id, method, actorId, row.id])
}

// Explicit repair tool: refuses ambiguous manual membership receipts rather than
// silently counting the same cash twice. Startup never guesses at existing entries.
export async function backfillSubscriptionRevenue(pool) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [manual] = await conn.query("SELECT id FROM finance_entries WHERE kind='revenue' AND source_subscription_id IS NULL AND voided_at IS NULL LIMIT 1 FOR UPDATE")
    if (manual.length) throw new Error('Reconcile manual revenue before backfilling paid subscriptions')
    const [rows] = await conn.query("SELECT * FROM member_subscriptions WHERE payment_status='paid' FOR UPDATE")
    for (const row of rows) {
      if (!row.payment_updated_at) throw new Error('Paid subscription has no review timestamp')
      await syncSubscriptionRevenue(conn,row,row.payment_updated_by,'paid',financeToday(new Date(row.payment_updated_at)),'other','Backfilled from paid review')
    }
    await conn.commit(); return { reviewed: rows.length }
  } catch(e) { await conn.rollback(); throw e } finally { conn.release() }
}
