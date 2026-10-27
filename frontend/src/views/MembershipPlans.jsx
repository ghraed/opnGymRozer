import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { membershipDuration, membershipPrice, filterMembershipPlans } from '../lib/membership-plans.js'
import { useUI } from '../store/useUI.js'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { confirmSheet } from '../sheets.jsx'
import BottomSheet from '../components/BottomSheet.jsx'
import FilterPanel from '../components/FilterPanel.jsx'

function PlanEditor({ plan, onSaved, onCancel }) {
  const [draft, setDraft] = useState(() => plan ? { ...plan } : {
    name: '', description: '', durationCount: 1, durationUnit: 'month', price: '', currency: 'USD',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const nameInput = useRef(null)
  useEffect(() => { nameInput.current?.focus() }, [])
  const field = key => ({ value: draft[key], onChange: e => setDraft(d => ({ ...d, [key]: e.target.value })) })
  const save = async event => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const { plan: saved } = await api(plan ? '/api/admin/membership-plan' : '/api/admin/membership-plans', {
        method: plan ? 'PUT' : 'POST', body: JSON.stringify({ ...draft, durationCount: Number(draft.durationCount) }),
      })
      onSaved(saved)
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }
  return <BottomSheet title={plan ? 'Edit membership plan' : 'New membership plan'} description="Set the access period, benefits and total price." className="plan-editor-sheet" dismissible={!saving} closeLabel="Close plan editor" onClose={onCancel}>
  <form className="account-editor membership-editor" onSubmit={save} aria-label={plan ? 'Edit membership plan' : 'New membership plan'}>
    <fieldset disabled={saving}>
      <h3 className="plan-editor-section-title">Plan details</h3>
      <label>Plan name<input ref={nameInput} className="input" required maxLength={80} placeholder="e.g. Monthly gym access" {...field('name')} /></label>
      <label>Description and included benefits<textarea className="input" rows={3} maxLength={2000} placeholder="Describe what this plan includes" {...field('description')} /></label>
      <h3 className="plan-editor-section-title">Membership duration</h3>
      <div className="finance-presets plan-duration-presets" aria-label="Plan duration presets">{[['Day pass', 1, 'day'], ['Monthly', 1, 'month'], ['Quarterly', 3, 'month'], ['Yearly', 1, 'year']].map(([label, count, unit]) => <Button type="button" size="sm" key={label} aria-pressed={Number(draft.durationCount) === count && draft.durationUnit === unit} onClick={() => setDraft(d => ({ ...d, durationCount: count, durationUnit: unit }))}>{label}</Button>)}</div>
      <div className="membership-field-grid">
        <label>Duration<input className="input" type="number" required min="1" max="3650" step="1" {...field('durationCount')} /></label>
        <label>Duration unit<select className="input" aria-label="Duration unit" {...field('durationUnit')}><option value="day">Days</option><option value="week">Weeks</option><option value="month">Months</option><option value="year">Years</option></select></label>
      </div>
      <h3 className="plan-editor-section-title">Pricing</h3>
      <div className="membership-field-grid">
        <label>Total price<input className="input" type="text" inputMode="decimal" required maxLength={13} pattern="[0-9]+([.][0-9]{1,2})?" placeholder="0.00" {...field('price')} /></label>
        <label>Currency<select className="input" aria-label="Currency" {...field('currency')}><option value="USD">USD</option><option value="LBP">LBP</option></select></label>
      </div>
      <p className="plan-editor-note">The price covers the full {draft.durationCount || 'selected'} {draft.durationUnit}{Number(draft.durationCount) === 1 ? '' : 's'}. Enter 0 for a free plan. A one-month plan supports quick renewals.</p>
      {error && <p role="alert" style={{ color: 'var(--red)' }}>{error}</p>}
      <div className="client-account-actions plan-editor-footer"><Button type="submit" icon="check" variant="primary">{saving ? 'Saving…' : plan ? 'Save changes' : 'Create plan'}</Button><Button type="button" onClick={onCancel}>Cancel</Button></div>
    </fieldset>
  </form>
  </BottomSheet>
}

export default function MembershipPlans() {
  const toast = useUI(s => s.toast)
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [status, setStatus] = useState('active')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState(null)
  const [pending, setPending] = useState(null)
  const reload = () => setRevision(value => value + 1)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    api('/api/admin/membership-plans', { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setPlans(data.plans) })
      .catch(e => { if (!controller.signal.aborted) setError(e.message || 'Unable to load plans') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [revision])
  const changeStatus = plan => confirmSheet({
    title: `${plan.active ? 'Archive' : 'Restore'} ${plan.name}?`,
    message: plan.active ? 'Keep this plan saved and move it to the archived list. You can restore it later.' : 'Make this plan active again at its saved price.',
    confirmText: plan.active ? 'Archive plan' : 'Restore plan',
    onConfirm: async () => {
      setPending(plan.id)
      try {
        const { plan: saved } = await api('/api/admin/membership-plan/status', { method: 'POST', body: JSON.stringify({ id: plan.id, version: plan.version, active: !plan.active }) })
        setPlans(current => current.map(p => p.id === saved.id ? saved : p))
        toast(saved.active ? 'Plan restored' : 'Plan archived')
      } catch (e) { toast(e.message); reload() } finally { setPending(null) }
    },
  })
  const visible = filterMembershipPlans(plans, status, query)
  const activeCount = plans.filter(plan => plan.active).length
  const archivedCount = plans.length - activeCount
  return <main className="finance-page membership-plans plan-catalog">
    <header className="hdr finance-header"><Link className="iconbtn" to="/admin/finance" aria-label="Back to finance"><Icon name="chevronLeft" /></Link><div className="grow"><p className="finance-eyebrow">FINANCE / MEMBERSHIP CATALOG</p><h1>Membership plans</h1><p className="muted">Create flexible packages. Keep your pricing clear.</p></div><button className="iconbtn plan-catalog-refresh" aria-label="Refresh membership plans" disabled={loading || !!pending || !!editor} onClick={reload}><Icon name="reset" /></button></header>
    <section className="plan-catalog-overview" aria-label="Plan overview"><div><span className="plan-overview-icon"><Icon name="priceTag" size={22} /></span><div><strong>{loading ? '—' : activeCount}</strong><span>Active plans</span></div></div><div><span className="plan-overview-icon"><Icon name="clock" size={22} /></span><div><strong>{loading ? '—' : archivedCount}</strong><span>Archived plans</span></div></div></section>
    <div className="plan-catalog-tools"><div className="renewal-search"><Icon name="magnifier" /><input type="search" aria-label="Search membership plans" placeholder="Search plans, benefits or currency" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear plan search" onClick={() => setQuery('')}><Icon name="xmark" /></button>}</div><button type="button" className={'renewal-filter-trigger' + (status !== 'active' ? ' is-active' : '')} aria-label={`Filter plans: ${status}`} aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}><Icon name="filter" size={20} />{status !== 'active' && <span className="renewal-filter-indicator" />}</button><Button variant="primary" icon="plus" disabled={!!editor || !!pending || loading || !!error} onClick={() => setEditor({})}>New plan</Button></div>
    {editor && <PlanEditor key={editor.plan?.id || 'new'} plan={editor.plan} onCancel={() => setEditor(null)} onSaved={saved => {
      setPlans(current => [...current.filter(p => p.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)))
      setStatus(saved.active ? 'active' : 'archived'); setQuery(''); setEditor(null); toast('Membership plan saved')
    }} />}
    <div className="renewal-list-meta"><span role="status">{loading ? 'Loading your catalog…' : `${visible.length} ${status === 'all' ? '' : status + ' '}plan${visible.length === 1 ? '' : 's'}`}</span>{(query || status !== 'active') && <button type="button" onClick={() => { setQuery(''); setStatus('active') }}>Reset view</button>}</div>
    {filtersOpen && <FilterPanel title="Filter membership plans" legend="Plan status" value={status} resetValue="active" applyLabel="Show plans" options={[{ value: 'active', label: 'Active plans', count: activeCount }, { value: 'archived', label: 'Archived plans', count: archivedCount }, { value: 'all', label: 'All plans', count: plans.length }]} onClose={() => setFiltersOpen(false)} onApply={value => { setStatus(value); setFiltersOpen(false) }} />}
    {error && <div className="card" role="alert"><p>{error}</p><Button onClick={reload}>Try again</Button></div>}
    {loading ? <p role="status" className="muted">Loading membership plans…</p> : !error && <>
      {!visible.length && <div className="card empty plan-catalog-empty"><Icon name="priceTag" size={32} /><h2>{plans.length ? 'No matching plans' : 'Create your first membership plan'}</h2><p className="small muted">{plans.length ? 'Try another search or status filter.' : 'Start with a name, duration and price. No default prices are added.'}</p></div>}
      <div className="membership-grid">{visible.map(plan => <article className={'card membership-plan plan-catalog-card' + (!plan.active ? ' is-archived' : '')} key={plan.id}>
        <div className="plan-card-heading"><span className="plan-card-symbol"><Icon name="priceTag" size={20} /></span><span className={'plan-status-badge' + (plan.active ? ' is-active' : '')}><span aria-hidden="true" />{plan.active ? 'Active' : 'Archived'}</span></div>
        <h2>{plan.name}</h2><div className="plan-card-price"><span className="plan-card-price-label">Total price</span><strong>{membershipPrice(plan)}</strong><span className="plan-card-duration"><Icon name="calendar" />{membershipDuration(plan)}</span></div>
        {plan.description && <p className="membership-description">{plan.description}</p>}
        {plan.active && plan.durationUnit === 'month' && plan.durationCount === 1 && <p className="plan-quick-renewal"><Icon name="check" />Quick renewal available</p>}
        <div className="client-account-actions"><Button variant="tinted" icon="pencil" disabled={!!editor || !!pending} onClick={() => setEditor({ plan })}>Edit plan</Button><Button icon={plan.active ? 'minus' : 'reset'} disabled={!!editor || !!pending} onClick={() => changeStatus(plan)}>{pending === plan.id ? 'Saving…' : plan.active ? 'Archive' : 'Restore'}</Button></div>
      </article>)}</div>
    </>}
  </main>
}
