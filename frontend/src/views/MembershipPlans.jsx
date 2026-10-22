import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { membershipDuration, membershipPrice, filterMembershipPlans } from '../lib/membership-plans.js'
import { useUI } from '../store/useUI.js'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { confirmSheet } from '../sheets.jsx'

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
  return <form className="card account-editor membership-editor" onSubmit={save} aria-labelledby="plan-editor-title">
    <h2 id="plan-editor-title">{plan ? 'Edit membership plan' : 'New membership plan'}</h2>
    <fieldset disabled={saving}>
      <label>Plan name<input ref={nameInput} className="input" required maxLength={80} placeholder="e.g. Monthly gym access" {...field('name')} /></label>
      <label>Description and included benefits<textarea className="input" rows={3} maxLength={2000} placeholder="Describe what this plan includes" {...field('description')} /></label>
      <div className="finance-presets" aria-label="Plan duration presets">{[['Monthly', 1, 'month'], ['Quarterly', 3, 'month'], ['Yearly', 1, 'year']].map(([label, count, unit]) => <Button type="button" size="sm" key={label} onClick={() => setDraft(d => ({ ...d, durationCount: count, durationUnit: unit }))}>{label}</Button>)}</div>
      <div className="membership-field-grid">
        <label>Duration<input className="input" type="number" required min="1" max="3650" step="1" {...field('durationCount')} /></label>
        <label>Duration unit<select className="input" aria-label="Duration unit" {...field('durationUnit')}><option value="day">Days</option><option value="week">Weeks</option><option value="month">Months</option><option value="year">Years</option></select></label>
        <label>Price<input className="input" type="text" inputMode="decimal" required maxLength={13} pattern="[0-9]+([.][0-9]{1,2})?" placeholder="0.00" {...field('price')} /></label>
        <label>Currency<select className="input" aria-label="Currency" {...field('currency')}><option value="USD">USD</option><option value="LBP">LBP</option></select></label>
      </div>
      <p className="small muted">Total price for the selected duration. Enter 0 for a free plan. Each plan has one currency.</p>
      {error && <p role="alert" style={{ color: 'var(--red)' }}>{error}</p>}
      <div className="client-account-actions"><Button type="submit" variant="primary">{saving ? 'Saving…' : plan ? 'Save changes' : 'Create plan'}</Button><Button type="button" onClick={onCancel}>Cancel</Button></div>
    </fieldset>
  </form>
}

export default function MembershipPlans() {
  const toast = useUI(s => s.toast)
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [status, setStatus] = useState('active')
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
  return <main className="narrow membership-plans">
    <header className="hdr"><Link className="iconbtn" to="/admin/finance" aria-label="Back to finance"><Icon name="chevronLeft" /></Link><div className="grow"><h1>Membership plans</h1><p className="small muted">Set gym packages, duration and pricing.</p></div><button className="iconbtn" aria-label="Refresh membership plans" disabled={loading || !!pending || !!editor} onClick={reload}>↻</button></header>
    <div className="membership-toolbar"><span className="small muted">{plans.filter(p => p.active).length} active · {plans.filter(p => !p.active).length} archived</span><Button variant="primary" icon="plus" disabled={!!editor || !!pending || loading || !!error} onClick={() => setEditor({})}>New plan</Button></div>
    {editor && <PlanEditor key={editor.plan?.id || 'new'} plan={editor.plan} onCancel={() => setEditor(null)} onSaved={saved => {
      setPlans(current => [...current.filter(p => p.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)))
      setStatus(saved.active ? 'active' : 'archived'); setQuery(''); setEditor(null); toast('Membership plan saved')
    }} />}
    <div className="membership-filters"><label>Show<select className="input" aria-label="Show" value={status} onChange={e => setStatus(e.target.value)}><option value="active">Active plans</option><option value="archived">Archived plans</option><option value="all">All plans</option></select></label><label>Search<input className="input" type="search" placeholder="Name, benefit or currency" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
    {error && <div className="card" role="alert"><p>{error}</p><Button onClick={reload}>Try again</Button></div>}
    {loading ? <p role="status" className="muted">Loading membership plans…</p> : !error && <>
      {!visible.length && <div className="card empty"><h2>{plans.length ? 'No matching plans' : 'Create your first membership plan'}</h2><p className="small muted">{plans.length ? 'Try another search or status filter.' : 'Start with a name, duration and price. No default prices are added.'}</p></div>}
      <div className="membership-grid">{visible.map(plan => <article className="card membership-plan" key={plan.id}>
        <div className="row between"><h2>{plan.name}</h2><span className={'tag' + (plan.active ? ' acc' : '')}>{plan.active ? 'Active' : 'Archived'}</span></div>
        <p className="membership-price">{membershipPrice(plan)}</p><p className="small muted">for {membershipDuration(plan)}</p>
        {plan.description && <p className="membership-description">{plan.description}</p>}
        <div className="client-account-actions"><Button disabled={!!editor || !!pending} onClick={() => setEditor({ plan })}>Edit plan</Button><Button disabled={!!editor || !!pending} onClick={() => changeStatus(plan)}>{pending === plan.id ? 'Saving…' : plan.active ? 'Archive' : 'Restore'}</Button></div>
      </article>)}</div>
    </>}
  </main>
}
