import { useState } from 'react'
import { Link } from 'react-router-dom'
import { renewalHistory } from '../lib/renewals.js'
import { financeDate } from '../lib/finance.js'
import { membershipDuration, membershipPrice } from '../lib/membership-plans.js'
import { Button } from './ui.jsx'
import Icon from './Icon.jsx'

const termLabels = { active: 'Active', scheduled: 'Scheduled', expired: 'Expired', cancelled: 'Cancelled' }
const paymentLabels = { paid: 'Paid', unpaid: 'Awaiting payment', unconfirmed: 'Not reviewed', waived: 'Waived' }

export default function MemberRenewalTracker({ member, today, timezone, onChoosePlan, onQuickRenew, busy }) {
  const [shown, setShown] = useState(10)
  const { history, upcoming, current, daysLeft, progress, paidCount } = renewalHistory(member, today)
  const featured = current || upcoming[0] || member.latest
  const recorded = date => {
    const value = new Date(date)
    return Number.isFinite(value.getTime()) ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: timezone || 'UTC' }).format(value) : null
  }
  return <div className="member-renewal-tracker">
    <section className="card member-coverage-card" aria-label="Member coverage">
      <div className="member-coverage-heading"><div><p className="finance-eyebrow">{current ? 'CURRENT MEMBERSHIP' : upcoming.length ? 'UPCOMING MEMBERSHIP' : 'MEMBERSHIP OVERVIEW'}</p><h2>{featured?.planName || 'No membership yet'}</h2>{featured && <p className="small muted">{membershipPrice(featured)} · {membershipDuration(featured)}</p>}</div><span className={'tag finance-status ' + (featured?.status || 'none')}>{member.disabled ? 'Account disabled' : termLabels[featured?.status] || 'No membership'}</span></div>
      {current ? <><div className="member-coverage-progress-label"><span>{daysLeft === 1 ? '1 day remaining' : `${daysLeft} days remaining`}</span><strong>{current.paymentStatus === 'paid' ? 'Payment received' : paymentLabels[current.paymentStatus] || 'Not reviewed'}</strong></div><progress className={'member-coverage-progress' + (daysLeft <= 7 ? ' is-ending' : '')} value={progress} max="100" aria-label="Current coverage elapsed" aria-valuetext={`${daysLeft} days remaining`} /></> : <p className="member-coverage-note">{upcoming.length ? `Coverage starts ${financeDate(upcoming[0].startsOn)}.` : member.latest ? `Coverage ended ${financeDate(member.latest.endsOn)}. Choose a plan to renew.` : 'Choose a membership plan to start coverage.'}</p>}
      {featured && <dl className="member-coverage-dates"><div><dt>Coverage starts</dt><dd>{financeDate(featured.startsOn)}</dd></div><div><dt>Coverage ends</dt><dd>{financeDate(featured.endsOn)}</dd></div><div><dt>New renewal starts</dt><dd>{financeDate(member.startsOn)}</dd></div></dl>}
      {upcoming.length > 0 && current && <p className="member-coverage-booked"><Icon name="check" />Next booked term: {upcoming[0].planName} · {financeDate(upcoming[0].startsOn)}</p>}
      {member.disabled && <p className="renewal-overdue small">Enable this account before renewing.</p>}
      <div className="member-renewal-actions">{member.quickPlan && <Button variant="primary" disabled={member.disabled || busy} onClick={onQuickRenew}>Renew 1 month · {membershipPrice(member.quickPlan)}</Button>}<Button disabled={busy} onClick={onChoosePlan}>{featured ? 'Choose another plan' : 'Choose a plan'}<Icon name="chevronRight" /></Button><Link to={'/admin/clients/' + encodeURIComponent(member.id)}>View member profile</Link></div>
    </section>
    <div className="member-renewal-stats" aria-label="Membership history summary"><div><strong>{history.length}</strong><span>Membership terms</span></div><div><strong>{paidCount}</strong><span>Paid terms</span></div><div><strong>{upcoming.length}</strong><span>Upcoming terms</span></div></div>
    <section aria-labelledby="member-renewal-history-title"><div className="member-renewal-section-heading"><div><h2 id="member-renewal-history-title">Renewal history</h2><p>Every recorded term, newest coverage first.</p></div><span className="member-history-count">{history.length}</span></div>
      {history.length ? <ol className="member-renewal-timeline">{history.slice(0, shown).map(term => <li key={term.id} data-status={term.status}>
        <article className="member-renewal-event"><div className="member-renewal-event-heading"><div><h3>{term.planName}</h3><span className="small muted">{membershipDuration(term)}</span></div><strong>{membershipPrice(term)}</strong></div>
          <div className="member-renewal-event-dates"><Icon name="calendar" /><span>{financeDate(term.startsOn)} <span className="muted">→</span> {financeDate(term.endsOn)}</span></div>
          <div className="member-renewal-event-footer"><span className={'tag finance-status ' + term.status}>{termLabels[term.status] || term.status}</span><span className={'member-payment-badge is-' + term.paymentStatus}><Icon name={term.paymentStatus === 'paid' ? 'check' : 'wallet'} />{paymentLabels[term.paymentStatus] || 'Not reviewed'}</span>{term.createdAt && recorded(term.createdAt) && <span className="member-term-recorded">Recorded {recorded(term.createdAt)}</span>}</div>
          {(term.notes || term.cancellationReason) && <details className="member-term-notes"><summary>Term details</summary>{term.notes && <p>{term.notes}</p>}{term.cancellationReason && <p><strong>Cancellation reason:</strong> {term.cancellationReason}</p>}</details>}
        </article>
      </li>)}</ol> : <div className="card member-history-empty"><Icon name="history" size={28} /><h3>No renewal history yet</h3><p>The first membership and every renewal will appear here.</p><Button onClick={onChoosePlan}>Choose a first plan</Button></div>}
      {shown < history.length && <Button className="member-history-more" onClick={() => setShown(count => count + 10)}>Show earlier terms · {history.length - shown} more</Button>}
      {history.length > 0 && <p className="member-history-footnote">Coverage ends at the start of the displayed end date. Payment status is shown separately for each term.</p>}
    </section>
  </div>
}
