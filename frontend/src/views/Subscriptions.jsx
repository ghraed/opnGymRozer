import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../lib/api.js'
import { financeDate, filterSubscriptions } from '../lib/finance.js'
import { membershipPrice, membershipDuration } from '../lib/membership-plans.js'
import { useUI } from '../store/useUI.js'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

function SubscriptionEditor({ data, defaults, onSaved, onCancel }) {
  const [draft, setDraft] = useState(() => ({ memberId: defaults?.memberId || '', cycle: defaults?.cycle || 'monthly', planId: '', startsOn: defaults?.startsOn || data.asOf, notes: '' }))
  const [requestKey] = useState(() => crypto.randomUUID())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const memberSelect = useRef(null)
  useEffect(() => { memberSelect.current?.focus() }, [])
  const members = data.users.filter(u => u.role === 'client' && !u.disabled)
  const plans = data.plans.filter(p => p.active)
  const selectedPlan = plans.find(p => p.id === draft.planId)
  const field = key => ({ value: draft[key], onChange: e => setDraft(d => ({ ...d, [key]: e.target.value })) })
  const save = async event => {
    event.preventDefault(); if (!selectedPlan) return
    setSaving(true); setError('')
    try {
      await api('/api/admin/subscriptions', { method: 'POST', body: JSON.stringify({ ...draft, cycle: selectedPlan.subscriptionCycle, planVersion: selectedPlan.version, requestKey }) })
      onSaved()
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }
  return <form className="card account-editor" onSubmit={save} aria-label="New subscription">
    <h2>New member subscription</h2><fieldset disabled={saving}>
      <label>Member<select ref={memberSelect} className="input" aria-label="Member" required {...field('memberId')}><option value="">Choose a member</option>{members.map(member => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}</select></label>
      <label>Start date<input className="input" type="date" min="2000-01-01" max="9998-12-31" required {...field('startsOn')} /></label>
      <label>Pricing plan<select className="input" aria-label="Pricing plan" required {...field('planId')}><option value="">Choose a plan</option>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · {membershipDuration(plan)} · {membershipPrice(plan)}</option>)}</select></label>
      {!plans.length && <p className="finance-form-note">No active pricing plans. <Link to="/admin/memberships">Create a plan</Link>, then reopen this form.</p>}
      {selectedPlan && <div className="finance-quote"><span className="small muted">Agreed price for the full term</span><strong>{membershipPrice(selectedPlan)}</strong><p className="small muted">The subscription keeps this price if the plan changes later.</p></div>}
      <label>Notes (optional)<textarea className="input" rows={2} maxLength={1000} {...field('notes')} /></label>
      <p className="small muted">Coverage starts on the selected date. The end date follows the plan’s configured duration in days, weeks, months or years. Calendar months are adjusted to their last day when needed. Coverage ends at the start of that end date. No automatic renewal or charge.</p>
      {error && <p role="alert" style={{ color: 'var(--red)' }}>{error} {error.includes('Reload') && 'Cancel this form and refresh to review the latest plans.'}</p>}
      <div className="client-account-actions"><Button type="submit" variant="primary" disabled={!selectedPlan || !draft.memberId}>{saving ? 'Saving…' : 'Create subscription'}</Button><Button type="button" onClick={onCancel}>Cancel</Button></div>
    </fieldset>
  </form>
}

function CancelSubscription({ subscription, onDone, onCancel }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cancel = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try { await api('/api/admin/subscription/cancel', { method: 'POST', body: JSON.stringify({ id: subscription.id, version: subscription.version, reason }) }); onDone() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <form className="card account-editor" onSubmit={cancel} aria-label="Cancel subscription"><h2>Cancel {subscription.memberName}’s subscription?</h2><p>The term will be marked cancelled immediately. Its dates, agreed price and cancellation reason stay in the history. This does not issue a refund.</p><fieldset disabled={busy}>
    <label>Cancellation reason<textarea className="input" autoFocus required maxLength={500} rows={3} value={reason} onChange={e => setReason(e.target.value)} /></label>
    {error && <p role="alert" style={{ color: 'var(--red)' }}>{error}</p>}
    <div className="client-account-actions"><Button type="submit" variant="danger" disabled={!reason.trim()}>{busy ? 'Cancelling…' : 'Confirm cancellation'}</Button><Button type="button" onClick={onCancel}>Keep subscription</Button></div>
  </fieldset></form>
}

export default function Subscriptions() {
  const toast = useUI(s => s.toast)
  const renewalId = useLocation().state?.renewSubscriptionId
  const renewalOpened = useRef(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const reload = () => setRevision(n => n + 1)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    Promise.all([api('/api/admin/subscriptions', { signal: controller.signal }), api('/api/admin/membership-plans', { signal: controller.signal }), api('/api/admin/users', { signal: controller.signal })])
      .then(([subscriptions, plans, users]) => { if (!controller.signal.aborted) setData({ ...subscriptions, plans: plans.plans, users: users.users }) })
      .catch(e => { if (!controller.signal.aborted) setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [revision])
  useEffect(() => {
    if (!data || !renewalId || renewalOpened.current) return
    renewalOpened.current = true
    const subscription = data.subscriptions.find(s => s.id === renewalId)
    if (subscription?.memberId) setEditor({ memberId: subscription.memberId, cycle: subscription.cycle, startsOn: subscription.endsOn > data.asOf ? subscription.endsOn : data.asOf })
  }, [data, renewalId])
  const visible = data ? filterSubscriptions(data.subscriptions, status, query) : []
  return <main className="finance-page"><header className="hdr finance-header"><Link className="iconbtn" to="/admin/finance" aria-label="Back to finance"><Icon name="chevronLeft" /></Link><div className="grow"><p className="finance-eyebrow">FINANCE / MEMBERSHIPS</p><h1>Member subscriptions</h1><p className="muted">Membership terms based on each plan’s duration.</p></div></header>
    <div className="membership-toolbar"><Button disabled={loading || !!editor || !!cancelling} onClick={reload}>Refresh</Button><Button variant="primary" icon="plus" disabled={loading || !!error || !!editor || !!cancelling} onClick={() => setEditor({})}>New subscription</Button></div>
    {data && editor && <SubscriptionEditor data={data} defaults={editor} onCancel={() => setEditor(null)} onSaved={() => { setEditor(null); setStatus('all'); setQuery(''); toast('Subscription created'); reload() }} />}
    {cancelling && <CancelSubscription subscription={cancelling} onCancel={() => setCancelling(null)} onDone={() => { setCancelling(null); toast('Subscription cancelled'); reload() }} />}
    <div className="membership-filters"><label>Status<select className="input" aria-label="Subscription status" value={status} onChange={e => setStatus(e.target.value)}>{['all', 'active', 'scheduled', 'expired', 'cancelled'].map(value => <option key={value} value={value}>{value === 'all' ? 'All subscriptions' : value[0].toUpperCase() + value.slice(1)}</option>)}</select></label><label>Search<input className="input" type="search" placeholder="Member, plan or period" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
    {error && <div className="card" role="alert"><p>{error}</p><Button onClick={reload}>Try again</Button></div>}
    {loading ? <p role="status">Loading subscriptions…</p> : data && !error && <>
      <p className="small muted">{data.subscriptions.length} recorded terms · Status as of {financeDate(data.asOf)} ({data.timezone}). End dates show when coverage stops.</p>
      {!visible.length && <div className="card empty"><h2>{data.subscriptions.length ? 'No matching subscriptions' : 'Add your first member subscription'}</h2><p>Choose a member, a pricing plan and a start date to begin.</p><Link to="/admin/memberships">Manage pricing plans</Link></div>}
      <div className="subscription-list">{visible.map(subscription => <article className="card subscription-card" key={subscription.id}>
        <div className="row between"><div className="grow"><h2>{subscription.memberName}</h2><p className="small muted">{subscription.memberEmail || (subscription.memberId ? 'Client account' : 'Account deleted · record retained')}</p></div><span className={'tag finance-status ' + subscription.status}>{subscription.status}</span></div>
        <div className="subscription-plan"><strong>{subscription.planName}</strong><span>{subscription.durationCount ? membershipDuration(subscription) : data.cycles.find(c => c.id === subscription.cycle)?.label}</span><strong>{membershipPrice(subscription)}</strong></div>
        <dl className="subscription-dates"><div><dt>Starts on</dt><dd>{financeDate(subscription.startsOn)}</dd></div><div><dt>Ends on</dt><dd>{financeDate(subscription.endsOn)}</dd></div></dl>
        {subscription.notes && <p className="subscription-notes">{subscription.notes}</p>}
        {subscription.cancellationReason && <p className="small muted">Cancellation reason: {subscription.cancellationReason}</p>}
        <p className="small muted">Payment: {({ unconfirmed: 'Not reviewed', unpaid: 'Awaiting payment', paid: 'Paid', waived: 'Waived' })[subscription.paymentStatus]}</p>
        <div className="client-account-actions"><Link className="btn" to="/admin/renewals">Renewal tracker</Link>{subscription.memberId && <Link className="btn" to={'/admin/clients/' + encodeURIComponent(subscription.memberId)}>View member</Link>}
          {subscription.memberId && subscription.status !== 'cancelled' && <Button disabled={!!editor || !!cancelling} onClick={() => setEditor({ memberId: subscription.memberId, cycle: subscription.cycle, startsOn: subscription.endsOn > data.asOf ? subscription.endsOn : data.asOf })}>Add next term</Button>}
          {['active', 'scheduled'].includes(subscription.status) && <Button variant="danger" disabled={!!editor || !!cancelling} onClick={() => setCancelling(subscription)}>Cancel term</Button>}</div>
      </article>)}</div>
    </>}
  </main>
}
