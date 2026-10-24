import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { accountingMoney as money } from '../lib/accounting.js'

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const categories = { revenue: ['Memberships', 'Personal training', 'Retail', 'Other income'], expense: ['Rent', 'Salaries', 'Utilities', 'Equipment', 'Maintenance', 'Marketing', 'Other expenses'] }

function EntryEditor({ kind, onSaved, onCancel }) {
  const [draft, setDraft] = useState(() => ({ id: crypto.randomUUID(), kind, date: today(), amount: '', currency: 'USD', category: categories[kind][0], description: '', reference: '', method: 'cash' }))
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const first = useRef(null)
  useEffect(() => { first.current?.focus() }, [])
  const field = key => ({ value: draft[key], onChange: e => setDraft(d => ({ ...d, [key]: e.target.value })) })
  const save = async e => {
    e.preventDefault(); setPending(true); setError('')
    try { await api('/api/admin/ledger', { method: 'POST', body: JSON.stringify(draft) }); onSaved() }
    catch (e) { setError(e.message) } finally { setPending(false) }
  }
  return <form className="card account-editor accounting-editor" onSubmit={save} aria-labelledby="entry-editor-title">
    <h2 id="entry-editor-title">Record {kind}</h2><p className="muted small">Enter money actually {kind === 'revenue' ? 'received' : 'paid'}. Saving records a transaction; it does not move money.</p>
    <fieldset disabled={pending}><div className="accounting-fields">
      <label>Transaction date<input ref={first} className="input" type="date" min="2000-01-01" required {...field('date')} /></label>
      <label>Category<select className="input" {...field('category')}>{categories[kind].map(c => <option key={c}>{c}</option>)}</select></label>
      <label>Amount<input className="input" inputMode="decimal" required pattern="(0|[1-9][0-9]{0,9})([.][0-9]{1,2})?" maxLength={13} placeholder="0.00" {...field('amount')} /></label>
      <label>Currency<select className="input" {...field('currency')}><option>USD</option><option>LBP</option></select></label>
      <label>Payment method<select className="input" {...field('method')}>{['cash', 'card', 'transfer', 'other'].map(m => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}</select></label>
      <label>Reference (optional)<input className="input" maxLength={120} placeholder="Receipt, transfer or subscription reference" {...field('reference')} /></label>
    </div><label>Description<textarea className="input" required maxLength={500} rows={2} placeholder={kind === 'revenue' ? 'What was this payment for?' : 'What did the gym pay for?'} {...field('description')} /></label>
    {error && <p role="alert" className="accounting-error">{error}</p>}<div className="client-account-actions"><Button type="submit" variant="primary" icon="check" disabled={pending}>{pending ? 'Saving…' : 'Save entry'}</Button><Button type="button" onClick={onCancel}>Cancel</Button></div></fieldset>
  </form>
}
function VoidEntry({ entry, onSaved, onCancel }) {
  const [reason, setReason] = useState(''), [error, setError] = useState(''), [pending, setPending] = useState(false)
  return <form className="accounting-void" onSubmit={async e => { e.preventDefault(); setPending(true); setError(''); try { await api('/api/admin/ledger/void', { method: 'POST', body: JSON.stringify({ id: entry.id, reason }) }); onSaved() } catch (e) { setError(e.message) } finally { setPending(false) } }}>
    <p>Void this entry? It will be excluded from reports and retained in the audit history. Record a new entry to correct it.</p>
    <label>Reason<input className="input" autoFocus required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} disabled={pending} /></label>
    {error && <p role="alert" className="accounting-error">{error}</p>}<div className="client-account-actions"><Button type="submit" disabled={pending || !reason.trim()}>{pending ? 'Voiding…' : 'Confirm void'}</Button><Button type="button" disabled={pending} onClick={onCancel}>Keep entry</Button></div>
  </form>
}
export default function Accounting({ kind }) {
  const report = kind === 'report', title = report ? 'Profit & loss' : kind === 'revenue' ? 'Revenue' : 'Expenses'
  const [from, setFrom] = useState(() => today().slice(0, 7) + '-01'), [to, setTo] = useState(today)
  const [currency, setCurrency] = useState('all'), [status, setStatus] = useState('posted'), [page, setPage] = useState(1)
  const [data, setData] = useState(null), [summary, setSummary] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [revision, setRevision] = useState(0), [editing, setEditing] = useState(false), [voiding, setVoiding] = useState(null)
  const reload = () => setRevision(n => n + 1)
  const valid = from && to && from <= to && from >= '2000-01-01'
  useEffect(() => {
    const controller = new AbortController(); setData(null); setSummary(null); setError(''); setLoading(true)
    if (!valid) { setLoading(false); return () => controller.abort() }
    const period = new URLSearchParams({ from, to })
    Promise.all([api('/api/admin/profit-loss?' + period, { signal: controller.signal }), report ? Promise.resolve(null) : api('/api/admin/ledger?' + new URLSearchParams({ from, to, kind, currency, status, page }), { signal: controller.signal })])
      .then(([summary, data]) => { if (!controller.signal.aborted) { setSummary(summary); setData(data) } })
      .catch(e => { if (!controller.signal.aborted) setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [from, to, kind, currency, status, page, revision, valid, report])
  const currencies = summary?.currencies.filter(c => currency === 'all' || c.currency === currency) || []
  return <main className="finance-page accounting-page">
    <header className="hdr finance-header"><Link className="iconbtn" to="/admin/finance" aria-label="Back to finance"><Icon name="chevronLeft" /></Link><div className="grow"><p className="finance-eyebrow">FINANCE / CASH LEDGER</p><h1>{title}</h1><p className="muted">{report ? 'A clear view of money received, money paid and the difference.' : kind === 'revenue' ? 'Record collected payments and other gym income.' : 'Track operating costs and payments made by your gym.'}</p></div></header>
    <nav className="accounting-tabs" aria-label="Accounting tools">{[['revenue', 'Revenue', 'chartLine'], ['expenses', 'Expenses', 'wallet'], ['profit-loss', 'Profit & loss', 'chart']].map(([path, text, icon]) => <Link key={path} to={'/admin/' + path} aria-current={title === text ? 'page' : undefined}><Icon name={icon} />{text}</Link>)}</nav>
    <div className="card accounting-policy"><Icon name="info" size={20} /><p>Cash basis · Only posted ledger entries are included. Paid subscriptions automatically create linked revenue. Record only other receipts here to avoid duplicates. USD and LBP are reported separately.</p></div>
    <section className="card accounting-controls" aria-label="Report filters"><div className="accounting-fields">
      <label>From (inclusive)<input className="input" type="date" min="2000-01-01" value={from} onChange={e => { setFrom(e.target.value); setPage(1) }} /></label>
      <label>To (inclusive)<input className="input" type="date" min={from || '2000-01-01'} value={to} onChange={e => { setTo(e.target.value); setPage(1) }} /></label>
      <label>Currency<select className="input" value={currency} onChange={e => { setCurrency(e.target.value); setPage(1) }}><option value="all">USD & LBP (separate)</option><option>USD</option><option>LBP</option></select></label>
      {!report && <label>Entries<select className="input" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}><option value="posted">Posted</option><option value="voided">Voided</option><option value="all">All entries</option></select></label>}
    </div><div className="accounting-actions"><Button icon="reset" onClick={reload} disabled={loading || !valid}>Refresh</Button>{!report && <Button variant="primary" icon="plus" onClick={() => setEditing(true)} disabled={editing}>Record {kind}</Button>}</div>
    {!valid && <p role="alert" className="accounting-error">Choose a valid date range starting in 2000 or later.</p>}</section>
    {editing && <EntryEditor kind={kind} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); setPage(1); reload() }} />}
    {error && <div className="card" role="alert"><p>{error}</p><Button onClick={reload}>Try again</Button></div>}
    {loading && <p className="card" role="status">Loading {title.toLowerCase()}…</p>}
    {!loading && !error && valid && <>
      <section className="accounting-balances" aria-label="Posted totals">{currencies.map(c => <article className="card accounting-balance" key={c.currency}><p className="finance-eyebrow">{c.currency} · {from} — {to}</p>{report ? <><h2 className="accounting-total">{money(c.profit, c.currency)}</h2><p className="muted">Net {c.profit.startsWith('-') ? 'loss' : 'profit'}</p><dl><div><dt>Revenue</dt><dd>{money(c.revenue, c.currency)}</dd></div><div><dt>Expenses</dt><dd>{money(c.expenses, c.currency)}</dd></div></dl></> : <><h2 className="accounting-total">{money(kind === 'revenue' ? c.revenue : c.expenses, c.currency)}</h2><p className="muted">Posted {kind} in this period</p></>}</article>)}</section>
      {report ? currencies.map(c => <section key={c.currency} className="card accounting-report"><h2>{c.currency} statement</h2><p className="small muted">Revenue − expenses = net profit / loss. Voided entries are excluded.</p><h3>Monthly performance</h3>{!c.months.length ? <p className="accounting-empty">No posted entries in this period.</p> : <div className="accounting-table-wrap"><table><caption className="sr-only">{c.currency} monthly profit and loss</caption><thead><tr><th scope="col">Month</th><th scope="col">Revenue</th><th scope="col">Expenses</th><th scope="col">Net result</th></tr></thead><tbody>{c.months.map(m => <tr key={m.month}><th scope="row">{m.month}</th><td>{money(m.revenue, c.currency)}</td><td>{money(m.expenses, c.currency)}</td><td>{money(m.profit, c.currency)}</td></tr>)}</tbody></table></div>}<h3>Category breakdown</h3>{c.categories.map(row => <div className="accounting-category" key={row.kind + row.category}><span><span className="small muted">{row.kind === 'revenue' ? 'Revenue' : 'Expense'}</span><br />{row.category}</span><strong>{money(row.total, c.currency)}</strong></div>)}</section>) : <section aria-label={`${title} entries`}>
      <div className="admin-member-heading"><h2>Transaction history</h2><span className="small muted">{data?.total || 0} entries · {status}</span></div>
      {!data?.entries.length && <div className="card accounting-empty"><Icon name={kind === 'revenue' ? 'chartLine' : 'wallet'} size={32} /><h2>No {kind} entries found</h2><p>Record a transaction or choose another period or status.</p></div>}
      {data?.entries.map(e => <article className="card accounting-entry" key={e.id}><div className="accounting-entry-top"><span className="admin-tool-icon"><Icon name={e.kind === 'revenue' ? 'arrowDown' : 'arrowUp'} size={24} /></span><div className="grow"><h3>{e.description}</h3><p className="small muted">{e.date} · {e.category} · {e.method}</p></div><strong>{money(e.amount, e.currency)}</strong></div>{e.reference && <p className="small muted">Reference: {e.reference}</p>}<div className="accounting-entry-footer"><span className="small muted">{e.voidedAt ? 'Voided' : 'Posted'} · Recorded {new Date(e.createdAt).toLocaleString()}</span>{e.sourceSubscriptionId && <Link className="btn" to="/admin/renewals">Review subscription payment</Link>}{!e.voidedAt && !e.sourceSubscriptionId && <Button size="sm" disabled={!!voiding} onClick={() => setVoiding(e.id)}>Void entry</Button>}</div>{e.voidedAt && <p className="small accounting-void-note">Voided {new Date(e.voidedAt).toLocaleString()} · {e.voidReason}</p>}{voiding === e.id && <VoidEntry entry={e} onCancel={() => setVoiding(null)} onSaved={() => { setVoiding(null); reload() }} />}</article>)}
      {data && data.total > 50 && <div className="accounting-pagination"><Button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button><span>Page {page} of {Math.ceil(data.total / 50)}</span><Button disabled={page * 50 >= data.total} onClick={() => setPage(p => p + 1)}>Next</Button></div>}
    </section>}
    </>}
  </main>
}
