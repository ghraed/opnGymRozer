import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { financeDate } from '../lib/finance.js'
import { membershipPrice } from '../lib/membership-plans.js'
import { Button } from '../components/ui.jsx'
import { useUI } from '../store/useUI.js'
import { confirmSheet } from '../sheets.jsx'

const paymentLabels = { unconfirmed: 'Not reviewed', unpaid: 'Awaiting payment', paid: 'Paid', waived: 'Waived / no payment due' }
const renewalLabels = { overdue: 'Renewal overdue', due_soon: 'Expiring soon', renewed: 'Next term recorded', current: 'Current', cancelled: 'Cancelled' }
const deliveryLabels = { pending: 'Queued', processing: 'Processing', push_sent: 'Push accepted', in_app: 'In-app only', failed: 'Push retry / failed', skipped: 'No longer applicable' }

function PaymentReview({ subscription, today, onSaved, onCancel }) {
  const [status, setStatus] = useState(subscription.paymentStatus)
  const [dueOn, setDueOn] = useState(subscription.paymentDueOn || today)
  const [receivedOn, setReceivedOn] = useState(today)
  const [paymentMethod, setPaymentMethod] = useState('other')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try { await api('/api/admin/subscription/payment', { method: 'POST', body: JSON.stringify({ id: subscription.id, version: subscription.version, paymentStatus: status, dueOn, note, receivedOn, paymentMethod }) }); onSaved() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <form className="card account-editor" aria-label="Review payment" onSubmit={save}><h2>Review payment · {subscription.memberName}</h2><p>{subscription.planName} · {membershipPrice(subscription)} for the full term.</p><fieldset disabled={busy}>
    <label>Payment status<select className="input" aria-label="Payment status" value={status} onChange={e => setStatus(e.target.value)}>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {status === 'unpaid' && <label>Payment due date<input className="input" type="date" min="2000-01-01" max="9999-12-31" required value={dueOn} onChange={e => setDueOn(e.target.value)} /></label>}
    {status === 'paid' && subscription.paymentStatus !== 'paid' && <div className="account-profile-fields"><label>Payment received on<input className="input" type="date" required min="2000-01-01" value={receivedOn} onChange={e => setReceivedOn(e.target.value)} /></label><label>Payment method<select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>{['cash','card','transfer','other'].map(m => <option key={m} value={m}>{m}</option>)}</select></label></div>}
    <label>Review note<textarea className="input" autoFocus required maxLength={500} rows={2} placeholder="Record how you confirmed this status" value={note} onChange={e => setNote(e.target.value)} /></label>
    <p className="small muted">Marking Paid records the full quoted price in Revenue and Profit & loss. Repeated paid reviews keep the existing receipt and its date. Changing Paid to another status voids the linked receipt as a correction; it does not issue a refund. Free terms create no revenue.</p>
    {error && <p role="alert" style={{ color: 'var(--red)' }}>{error}</p>}
    <div className="client-account-actions"><Button type="submit" variant="primary" disabled={!note.trim()}>{busy ? 'Saving…' : 'Save payment review'}</Button><Button type="button" onClick={onCancel}>Cancel</Button></div>
  </fieldset></form>
}
function ReminderSettings({ settings, onSaved }) {
  const [draft, setDraft] = useState(settings)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try { await api('/api/admin/reminder-settings', { method: 'PUT', body: JSON.stringify(draft) }); onSaved() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <details className="card renewal-settings"><summary>Automatic reminder settings · {settings.enabled ? 'On' : 'Off'}</summary><form className="account-editor" aria-label="Automatic reminder settings" onSubmit={save}><fieldset disabled={busy}>
    <label className="row"><input type="checkbox" checked={draft.enabled} onChange={e => setDraft(d => ({ ...d, enabled: e.target.checked }))} />Enable automatic membership reminders</label>
    <div className="account-profile-fields">{[['renewalLeadDays', 'Days before membership ends', 0, 60], ['paymentLeadDays', 'Days before payment is due', 0, 60], ['repeatDays', 'Repeat unresolved reminders every (days)', 1, 30]].map(([key, label, min, max]) => <label key={key}>{label}<input className="input" type="number" required min={min} max={max} step="1" value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value === '' ? '' : Number(e.target.value) }))} /></label>)}</div>
    <p className="small muted">The server checks every minute. Members see reminders in the app; push is attempted only where enabled. Reminders repeat at this interval until resolved. Manual reminders are limited to one per type, per subscription, per day.</p>
    {error && <p role="alert" style={{ color: 'var(--red)' }}>{error}</p>}
    <Button type="submit" variant="primary">{busy ? 'Saving…' : 'Save reminder settings'}</Button>
  </fieldset></form></details>
}

export default function RenewalFollowups({ memberId, onUpdated }) {
  const toast = useUI(s => s.toast)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [filter, setFilter] = useState(memberId ? 'all' : 'attention')
  const [query, setQuery] = useState('')
  const [review, setReview] = useState(null)
  const [pending, setPending] = useState(null)
  const reload = () => setRevision(n => n + 1)
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('')
    api('/api/admin/renewals', { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setData(value) }).catch(e => { if (!controller.signal.aborted) setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [revision])
  const send = (subscription, kind) => confirmSheet({ title: `Send ${kind} reminder?`, message: `Notify ${subscription.memberName} about ${subscription.planName}. The reminder will appear in their app; push will be attempted if enabled.`, confirmText: 'Send reminder', onConfirm: async () => {
    setPending(subscription.id)
    try { const { reminder } = await api('/api/admin/subscription/remind', { method: 'POST', body: JSON.stringify({ id: subscription.id, kind }) }); toast(deliveryLabels[reminder.delivery] || 'Reminder recorded'); reload() }
    catch (e) { toast(e.message) } finally { setPending(null) }
  } })
  const subscriptions = (data?.subscriptions || []).filter(subscription => !memberId || subscription.memberId === memberId)
  const subscriptionIds = new Set(subscriptions.map(subscription => subscription.id))
  const reminders = (data?.history || []).filter(item => !memberId || subscriptionIds.has(item.subscriptionId))
  const rows = subscriptions.filter(s => {
    const attention = ['overdue', 'due_soon'].includes(s.renewalStatus) || s.paymentStatus === 'unpaid'
    const matches = filter === 'all' || (filter === 'attention' ? attention && s.status !== 'cancelled' : filter === 'unpaid' ? s.paymentStatus === 'unpaid' && s.status !== 'cancelled' : filter === 'unconfirmed' ? s.paymentStatus === 'unconfirmed' && s.status !== 'cancelled' : s.renewalStatus === filter)
    return matches && [s.memberName, s.memberEmail, s.planName].filter(Boolean).some(value => value.toLowerCase().includes(query.trim().toLowerCase()))
  })
  return <section className="renewal-followups"><header className="hdr finance-header"><div className="grow"><p className="finance-eyebrow">FINANCE / FOLLOW-UP</p><h2>Payments & reminders</h2><p className="muted">Follow up on expiring memberships and reviewed unpaid terms.</p></div></header>
    <div className="membership-toolbar"><span className="small muted">{data ? 'Status as of ' + financeDate(data.asOf) : 'Loading tracker…'}</span><Button disabled={loading || !!review || !!pending} onClick={reload}>Refresh tracker</Button></div>
    {error && <div className="card" role="alert"><p>{error}</p><Button onClick={reload}>Try again</Button></div>}
    {data && <>
      <section className="finance-summary" aria-label="Renewal overview">{[['Expiring soon', s => s.renewalStatus === 'due_soon'], ['Renewal overdue', s => s.renewalStatus === 'overdue'], ['Awaiting payment', s => s.paymentStatus === 'unpaid' && s.status !== 'cancelled'], ['Payment not reviewed', s => s.paymentStatus === 'unconfirmed' && s.status !== 'cancelled']].map(([label, fn]) => <div className="card" key={label}><span className="small muted">{label}</span><strong>{subscriptions.filter(fn).length}</strong></div>)}</section>
      {!memberId && <ReminderSettings key={'settings-' + revision} settings={data.settings} onSaved={() => { toast('Reminder settings saved'); reload() }} />}
      <p className="small muted">Older subscriptions start as “Not reviewed”. Review payment and set a due date to enable payment reminders. Paid or waived terms stop payment reminders; a next term stops renewal reminders.</p>
      {review && <PaymentReview subscription={review} today={data.asOf} onCancel={() => setReview(null)} onSaved={() => { setReview(null); toast('Payment status updated'); reload(); onUpdated?.() }} />}
      <div className="membership-filters"><label>Show<select className="input" aria-label="Renewal filter" value={filter} onChange={e => setFilter(e.target.value)}>{[['attention', 'Needs attention'], ['due_soon', 'Expiring soon'], ['overdue', 'Renewal overdue'], ['unpaid', 'Awaiting payment'], ['unconfirmed', 'Payment not reviewed'], ['renewed', 'Next term recorded'], ['all', 'All terms']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Search<input className="input" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Member or plan" /></label></div>
      {loading ? <p role="status">Refreshing tracker…</p> : !error && <div className="subscription-list">{rows.map(s => <article className="card subscription-card" key={s.id}>
        <div className="row between"><h2>{s.memberName}</h2><span className="tag">{renewalLabels[s.renewalStatus]}</span></div><p>{s.planName} · {membershipPrice(s)}</p>
        <dl className="subscription-dates"><div><dt>Coverage ends</dt><dd>{financeDate(s.endsOn)}</dd></div><div><dt>Payment</dt><dd>{paymentLabels[s.paymentStatus]}</dd></div></dl>
        {s.paymentDueOn && <p className={'small' + (s.paymentOverdue ? ' renewal-overdue' : ' muted')}>Payment {s.paymentOverdue ? 'overdue since ' : 'due on '}{financeDate(s.paymentDueOn)}</p>}
        {!s.canRemind && <p className="small muted">Reminders unavailable: member account is deleted, disabled or no longer a client.</p>}
        <div className="client-account-actions"><Button disabled={!!review || !!pending} onClick={() => setReview(s)}>Review payment</Button>
          {s.memberId && s.status !== 'cancelled' && !s.nextTermId && <Link className="btn" state={{ choosePlan: true }} to={'/admin/renewals/' + encodeURIComponent(s.memberId)}>Add next term</Link>}
          {s.canRemind && s.status !== 'cancelled' && !s.nextTermId && <Button disabled={!!review || !!pending} onClick={() => send(s, 'renewal')}>Remind renewal</Button>}
          {s.canRemind && s.status !== 'cancelled' && s.paymentStatus === 'unpaid' && <Button disabled={!!review || !!pending} onClick={() => send(s, 'payment')}>Remind payment</Button>}
        </div>
        <details className="renewal-audit"><summary>Payment review history</summary>{data.paymentEvents.filter(e => e.subscriptionId === s.id).map((event, i) => <p className="small" key={i}><strong>{paymentLabels[event.to]}</strong> · {event.actor}<br />{new Date(event.createdAt).toLocaleString()}<br />{event.note}</p>)}{!data.paymentEvents.some(e => e.subscriptionId === s.id) && <p className="small muted">No recent review recorded.</p>}</details>
      </article>)}{!rows.length && <div className="card empty">No matching follow-ups.</div>}</div>}
      <details className="card renewal-history"><summary>Recent reminder history</summary><p className="small muted">Latest 100 reminders. “Push accepted” confirms acceptance by the push service, not that the member saw it.</p>{reminders.map(item => <div key={item.id} className="client-row"><div><strong>{item.memberName}</strong><p className="small muted">{item.kind} · {financeDate(item.date)} · {item.source}</p></div><div><span className="tag">{deliveryLabels[item.delivery]}</span><p className="small muted">{item.detail} · {item.attempts} delivery attempts</p></div></div>)}{!reminders.length && <p className="small muted">{memberId ? 'No reminders in recent history.' : 'No reminders sent yet.'}</p>}</details>
    </>}
  </section>
}
