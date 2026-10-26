import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { legacyRenewalPath } from '../lib/routing.js'
import { financeDate } from '../lib/finance.js'
import { membershipDuration, membershipPrice } from '../lib/membership-plans.js'
import { renewalMembers } from '../lib/renewals.js'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import RenewalConfirmation from '../components/RenewalConfirmation.jsx'
import FilterPanel from '../components/FilterPanel.jsx'
import { useUI } from '../store/useUI.js'

const RenewalFollowups = lazy(() => import('./RenewalFollowups.jsx'))
const labels = { active: 'Active', scheduled: 'Scheduled', expired: 'Expired', none: 'No membership' }
const payments = { paid: 'Paid', unpaid: 'Awaiting payment', unconfirmed: 'Not reviewed', waived: 'Waived' }


export default function Renewals() {
  const { memberId } = useParams()
  const [params] = useSearchParams()
  const legacyPath = legacyRenewalPath(params)
  return legacyPath ? <Navigate to={legacyPath} replace /> : <RenewalWorkspace memberId={memberId} />
}

function RenewalWorkspace({ memberId }) {
  const toast = useUI(s => s.toast)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [renewal, setRenewal] = useState(null)
  const [success, setSuccess] = useState('')
  const [followups, setFollowups] = useState(false)
  const reload = () => setRevision(n => n + 1)
  useEffect(() => { window.scrollTo(0, 0); setSuccess('') }, [memberId])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    Promise.all([api('/api/admin/subscriptions', { signal: controller.signal }), api('/api/admin/users', { signal: controller.signal }), api('/api/admin/membership-plans', { signal: controller.signal })])
      .then(([subscriptions, users, plans]) => { if (!controller.signal.aborted) setData({ ...subscriptions, users: users.users, plans: plans.plans }) })
      .catch(e => { if (!controller.signal.aborted) setError(e.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [revision])
  const members = data ? renewalMembers(data.users, data.subscriptions, data.plans, data.asOf) : []
  const selected = members.find(m => m.id === memberId)
  const activePlans = data?.plans.filter(p => p.active) || []
  const visible = members.filter(m => (filter === 'all' || m.status === filter) && [m.name, m.email].some(v => v?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))
  const choose = (member, plan) => setRenewal({ member, plan, startsOn: member.startsOn, today: data.asOf })
  return <main className="finance-page quick-renewals">
    <header className="hdr finance-header"><Link className="iconbtn" to={memberId ? '/admin/renewals' : '/admin/finance'} aria-label={memberId ? 'Back to all members' : 'Back to finance'}><Icon name="chevronLeft" /></Link><div className="grow"><p className="finance-eyebrow">FINANCE / RENEWALS</p><h1>{memberId ? selected?.name || 'Member renewal' : 'Renewals'}</h1><p className="muted">{memberId ? 'Choose a plan. Confirm. Done.' : 'Manage coverage and renew memberships.'}</p></div></header>
    <div className="membership-toolbar renewal-toolbar"><Link to="/admin/memberships"><Icon name="priceTag" />Plans & pricing</Link><Button size="sm" icon="reset" disabled={loading || !!renewal} onClick={reload}>Refresh</Button></div>
    {success && <div className="card renewal-success" role="status">{success}</div>}
    {error && <div className="card" role="alert"><p>{error}</p><Button onClick={reload}>Try again</Button></div>}
    {loading ? <p role="status">Loading members…</p> : data && !error && <>
      {memberId ? selected ? <>
        <section className="card renewal-member-summary" aria-label="Member coverage"><div className="row between"><div><h2>{selected.name}</h2><p className="small muted">{selected.email}</p></div><span className={'tag finance-status ' + selected.status}>{labels[selected.status]}</span></div><p>{selected.latest ? <>Latest coverage ends <strong>{financeDate(selected.latest.endsOn)}</strong>.</> : 'No membership recorded yet.'} New coverage starts <strong>{financeDate(selected.startsOn)}</strong>.</p>{selected.disabled && <p className="renewal-overdue">This account is disabled. Enable it before renewing.</p>}<Link to={'/admin/clients/' + encodeURIComponent(selected.id)}>View client profile</Link></section>
        <h2 className="finance-section-title">Choose a membership plan</h2><p className="muted">Each plan includes its full duration and total price.</p>
        <div className="membership-grid">{activePlans.map(plan => <article className="card membership-plan" key={plan.id}><h3>{plan.name}</h3><div className="renewal-plan-price"><strong>{membershipPrice(plan)}</strong><span className="small muted">{membershipDuration(plan)}</span></div>{plan.description && <p className="membership-description small muted">{plan.description}</p>}<div className="client-account-actions"><Button variant="primary" disabled={selected.disabled || !!renewal} onClick={() => choose(selected, plan)}>Renew · {membershipDuration(plan)}</Button></div></article>)}</div>
        {!activePlans.length && <div className="card empty"><h3>No active plans</h3><Link to="/admin/memberships">Create a membership plan</Link></div>}
        <details className="card renewal-history"><summary>Membership history · {selected.history.length} terms</summary>{selected.history.map(s => <div className="renewal-term" key={s.id}><strong>{s.planName} · {membershipPrice(s)}</strong><p className="small muted">{financeDate(s.startsOn)} – {financeDate(s.endsOn)} · {s.status} · {payments[s.paymentStatus]}</p></div>)}{!selected.history.length && <p className="muted">No previous memberships.</p>}</details>
      </> : <div className="card empty"><p>Client account not found.</p><Link to="/admin/renewals">Back to all members</Link></div> : <>
        <div className="renewal-search-toolbar">
          <div className="renewal-search"><Icon name="magnifier" /><input type="search" placeholder="Search name or email" aria-label="Find a member" value={query} onChange={e => setQuery(e.target.value)} />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear member search"><Icon name="xmark" /></button>}</div>
          <button type="button" className={'renewal-filter-trigger' + (filter !== 'all' ? ' is-active' : '')} aria-label={filter === 'all' ? 'Filter members by membership status' : `Filter members: ${labels[filter]}`} aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}><Icon name="filter" size={20} />{filter !== 'all' && <span className="renewal-filter-indicator" />}</button>
        </div>
        <div className="renewal-list-meta"><span role="status">{visible.length} of {members.length} members{filter !== 'all' ? ` · ${labels[filter]}` : ''}</span>{filter !== 'all' ? <button type="button" onClick={() => setFilter('all')}>Clear filter</button> : <span>As of {financeDate(data.asOf)}</span>}</div>
        {!activePlans.some(p => p.durationUnit === 'month' && p.durationCount === 1) && <p className="finance-form-note">For quick one-month renewals, <Link to="/admin/memberships">create an active plan with a duration of 1 month</Link>. Other plans are available inside each member.</p>}
        <div className="renewal-member-grid">{visible.map(member => <article className="card renewal-member-card" data-status={member.status} key={member.id}>
          <div className="renewal-card-heading"><span className="renewal-avatar" aria-hidden="true">{member.name.trim().slice(0, 1).toUpperCase()}</span><div className="grow"><h2><Link to={'/admin/renewals/' + encodeURIComponent(member.id)}>{member.name}</Link></h2><p className="small muted">{member.email}</p></div><span className={'tag finance-status ' + member.status}>{member.disabled ? 'Disabled' : labels[member.status]}</span></div>
          <div className="renewal-coverage"><div><span className="renewal-detail-label">Membership</span><strong>{member.latest?.planName || 'No plan assigned'}</strong>{member.latest && <span className="small muted">{membershipPrice(member.latest)}</span>}</div><div className="renewal-coverage-date"><span className="renewal-detail-label">{member.status === 'expired' ? 'Expired on' : member.status === 'scheduled' ? 'Coverage ends' : 'Renewal date'}</span><strong>{member.latest ? financeDate(member.latest.endsOn) : '—'}</strong></div></div>
          <div className="renewal-card-footer"><div className="renewal-actions">{member.quickPlan ? <Button variant="primary" disabled={member.disabled || !!renewal} onClick={() => choose(member, member.quickPlan)} aria-label={`Renew ${member.name} for one month at ${membershipPrice(member.quickPlan)}`}><span className="renewal-button-label">Renew 1 month<small>{membershipPrice(member.quickPlan)}</small></span></Button> : <Link className="btn primary" to={'/admin/renewals/' + encodeURIComponent(member.id)}>Choose a plan</Link>}<Link className="btn" to={'/admin/renewals/' + encodeURIComponent(member.id)}>All plans<Icon name="chevronRight" /></Link></div></div>
        </article>)}</div>
        {!visible.length && <div className="card empty">{members.length ? 'No members match your search.' : 'No client accounts yet.'}</div>}
      </>}
      <details className="renewal-tools" onToggle={e => setFollowups(e.currentTarget.open)}><summary>Payments & reminders</summary>{followups && <Suspense fallback={<p role="status">Loading follow-ups…</p>}><RenewalFollowups key={revision} /></Suspense>}</details>
    </>}
    {filtersOpen && <FilterPanel title="Filter members" legend="Membership status" applyLabel="Show members" value={filter} options={Object.entries({ all: 'All members', ...labels }).map(([value, label]) => ({ value, label, count: value === 'all' ? members.length : members.filter(member => member.status === value).length }))} onApply={value => { setFilter(value); setFiltersOpen(false) }} onClose={() => setFiltersOpen(false)} />}
    {renewal && <RenewalConfirmation renewal={renewal} onClose={() => setRenewal(null)} onSaved={() => { const message = `${renewal.member.name} renewed for ${membershipDuration(renewal.plan)}.`; setRenewal(null); setSuccess(message); toast(message); reload() }} />}
  </main>
}
