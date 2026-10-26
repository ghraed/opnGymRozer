import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { financeDate } from '../lib/finance.js'
import { membershipDuration, membershipPrice } from '../lib/membership-plans.js'
import { renewalEnd } from '../lib/renewals.js'
import { Button } from './ui.jsx'

export default function RenewalConfirmation({ renewal, onClose, onSaved }) {
  const { member, plan, startsOn } = renewal
  const endsOn = renewalEnd(startsOn, plan)
  const dialog = useRef(null)
  const submitting = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Keep this key for retries, including a lost response after the server committed.
  const [requestKey] = useState(() => crypto.randomUUID())
  useEffect(() => {
    const trigger = document.activeElement
    dialog.current.showModal()
    return () => { trigger?.focus() }
  }, [])
  const save = async () => {
    if (submitting.current || !endsOn) return
    submitting.current = true; setBusy(true); setError('')
    try {
      await api('/api/admin/subscriptions', { method: 'POST', body: JSON.stringify({ memberId: member.id, planId: plan.id, planVersion: plan.version, cycle: plan.subscriptionCycle, startsOn, requestKey }) })
      onSaved()
    } catch (e) { setError(e.message) } finally { submitting.current = false; setBusy(false) }
  }
  return <dialog ref={dialog} className="renewal-confirm" aria-labelledby="renewal-confirm-title" onCancel={e => { e.preventDefault(); if (!submitting.current) onClose() }}>
    <p className="finance-eyebrow">CONFIRM RENEWAL</p><h2 id="renewal-confirm-title">Renew {member.name}?</h2>
    <div className="finance-quote"><strong>{plan.name}</strong><p>{membershipDuration(plan)} · {membershipPrice(plan)}</p></div>
    {endsOn ? <dl className="subscription-dates"><div><dt>Starts on</dt><dd>{financeDate(startsOn)}</dd></div><div><dt>Coverage ends</dt><dd>{financeDate(endsOn)}</dd></div></dl> : <p role="alert">This plan’s end date is out of range. Choose a shorter plan.</p>}
    <p className="small muted">{startsOn > renewal.today ? 'Added after existing booked coverage.' : 'Coverage starts today.'} Coverage stops at the start of the end date. Payment can be reviewed in Payments & reminders.</p>
    {error && <p className="renewal-overdue" role="alert">{error}</p>}
    <div className="renewal-actions"><Button variant="primary" disabled={busy || !endsOn} onClick={save}>{busy ? 'Renewing…' : 'Confirm renewal'}</Button><Button autoFocus disabled={busy} onClick={onClose}>Cancel</Button></div>
  </dialog>
}
