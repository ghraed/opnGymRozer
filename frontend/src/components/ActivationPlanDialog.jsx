import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { financeDate } from '../lib/finance.js'
import { membershipDuration, membershipPrice } from '../lib/membership-plans.js'
import { renewalEnd } from '../lib/renewals.js'
import { Button } from './ui.jsx'

export default function ActivationPlanDialog({ member, onClose, onSaved }) {
  const dialog = useRef(null)
  const submitting = useRef(false)
  const [data, setData] = useState(null)
  const [planId, setPlanId] = useState('')
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const trigger = document.activeElement
    dialog.current.showModal()
    return () => { trigger?.focus() }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setPlanId(''); setError(''); setRequestKey(crypto.randomUUID())
    api('/api/admin/activation-plans', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [revision])
  const plan = data?.plans.find(p => p.id === planId)
  const endsOn = plan && renewalEnd(data.asOf, plan)
  const save = async event => {
    event.preventDefault()
    if (submitting.current || !plan || !endsOn) return
    submitting.current = true; setBusy(true); setError('')
    try {
      await api('/api/admin/user/activate', { method: 'POST', body: JSON.stringify({ id: member.id, planId: plan.id, planVersion: plan.version, cycle: plan.subscriptionCycle, startsOn: data.asOf, requestKey }) })
      onSaved()
    } catch (e) { setError(e.message) } finally { submitting.current = false; setBusy(false) }
  }
  return <dialog ref={dialog} className="renewal-confirm" aria-labelledby="activation-plan-title" onCancel={event => { event.preventDefault(); if (!submitting.current) onClose() }}>
    <form onSubmit={save} className="account-editor">
      <p className="finance-eyebrow">APPROVE MEMBERSHIP</p><h2 id="activation-plan-title">Approve {member.name}</h2>
      <p className="small muted">Choose a membership plan to activate this account. Coverage starts today.</p>
      <fieldset disabled={busy}>
        {!data && !error && <p role="status">Loading membership plans…</p>}
        {data && <label>Membership plan<select autoFocus className="input" required value={planId} onChange={event => { setPlanId(event.target.value); setRequestKey(crypto.randomUUID()); setError('') }}><option value="">Choose a plan</option>{data.plans.map(p => <option key={p.id} value={p.id}>{p.name} · {membershipDuration(p)} · {membershipPrice(p)}</option>)}</select></label>}
        {data && !data.plans.length && <p className="finance-form-note">No active membership plans. An admin must create a plan before this request can be approved.</p>}
        {plan && <><div className="finance-quote"><strong>{plan.name}</strong><p>{membershipDuration(plan)} · {membershipPrice(plan)}</p></div>{endsOn ? <dl className="subscription-dates"><div><dt>Starts on</dt><dd>{financeDate(data.asOf)}</dd></div><div><dt>Coverage ends</dt><dd>{financeDate(endsOn)}</dd></div></dl> : <p role="alert">Choose a shorter plan. Its end date is out of range.</p>}<p className="small muted">This assigns the plan and approves access. Payment is recorded separately.</p></>}
        {error && <p className="renewal-overdue" role="alert">{error}</p>}
        <div className="renewal-actions"><Button type="submit" variant="primary" disabled={!plan || !endsOn || busy}>{busy ? 'Approving…' : 'Confirm plan & approve'}</Button><Button type="button" disabled={busy} onClick={onClose}>Cancel</Button></div>
        {error && <Button type="button" disabled={busy} onClick={() => setRevision(n => n + 1)}>Reload plans</Button>}
      </fieldset>
    </form>
  </dialog>
}
