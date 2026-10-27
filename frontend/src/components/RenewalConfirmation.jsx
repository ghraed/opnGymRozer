import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { financeDate } from '../lib/finance.js'
import { membershipDuration, membershipPrice } from '../lib/membership-plans.js'
import { renewalEnd } from '../lib/renewals.js'
import { Button } from './ui.jsx'

export default function RenewalConfirmation({ renewal, onClose, onSaved }) {
  const { member, plan, startsOn, markPaid = false } = renewal
  const endsOn = renewalEnd(startsOn, plan)
  const dialog = useRef(null)
  const submitting = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('other')
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
      await api('/api/admin/subscriptions', { method: 'POST', body: JSON.stringify({ memberId: member.id, planId: plan.id, planVersion: plan.version, cycle: plan.subscriptionCycle, startsOn, requestKey, ...(markPaid ? { paymentStatus: 'paid', receivedOn: renewal.today, paymentMethod } : {}) }) })
      onSaved()
    } catch (e) { setError(e.message) } finally { submitting.current = false; setBusy(false) }
  }
  return <dialog ref={dialog} className="renewal-confirm" aria-labelledby="renewal-confirm-title" onCancel={e => { e.preventDefault(); if (!submitting.current) onClose() }}>
    <p className="finance-eyebrow">CONFIRM RENEWAL</p><h2 id="renewal-confirm-title">Renew {member.name}?</h2>
    <div className="finance-quote"><strong>{plan.name}</strong><p>{membershipDuration(plan)} · {membershipPrice(plan)}</p></div>
    {endsOn ? <dl className="subscription-dates"><div><dt>Starts on</dt><dd>{financeDate(startsOn)}</dd></div><div><dt>Coverage ends</dt><dd>{financeDate(endsOn)}</dd></div></dl> : <p role="alert">This plan’s end date is out of range. Choose a shorter plan.</p>}
    <p className="small muted">{startsOn > renewal.today ? 'Added after existing booked coverage.' : 'Coverage starts today.'} Coverage stops at the start of the end date.{!markPaid && ' Payment can be reviewed in Payments & reminders.'}</p>
    {markPaid && <div className="renewal-payment-confirmation"><p><strong>Mark this renewal as Paid</strong></p><p className="small muted">Confirm that {membershipPrice(plan)} has been received. {Number(plan.price) === 0 ? 'This free term creates no revenue entry.' : <>The full amount will be added to Revenue on {financeDate(renewal.today)}.</>}</p><label className="small">Payment method<select className="input" disabled={busy || !!error} value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}><option value="other">Not specified / other</option><option value="cash">Cash</option><option value="card">Card</option><option value="transfer">Bank transfer</option></select></label></div>}
    {error && <p className="renewal-overdue" role="alert">{error}</p>}
    <div className="renewal-actions"><Button variant="primary" disabled={busy || !endsOn} onClick={save}>{busy ? 'Renewing…' : markPaid ? 'Confirm paid renewal' : 'Confirm renewal'}</Button><Button autoFocus disabled={busy} onClick={onClose}>Cancel</Button></div>
  </dialog>
}
