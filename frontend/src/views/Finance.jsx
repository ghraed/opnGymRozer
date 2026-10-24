import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { FINANCE_FEATURES, financeDate } from '../lib/finance.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

export default function Finance() {
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    api('/api/admin/finance', { signal: controller.signal }).then(setOverview).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [revision])
  return <main className="finance-page">
    <header className="hdr finance-header"><Link className="iconbtn" to="/admin" aria-label="Back to admin"><Icon name="chevronLeft" /></Link><div className="grow"><p className="finance-eyebrow">ADMIN WORKSPACE</p><h1>Finance</h1><p className="muted">Income, expenses, profit and membership management, in one place.</p></div><span className="tag acc">Admins only</span></header>
    {error && <div className="card" role="alert"><p>{error}</p><Button onClick={() => setRevision(n => n + 1)}>Try again</Button></div>}
    <section className="finance-summary" aria-label="Finance overview">
      {[['activePlans', 'Active pricing plans'], ['activeSubscriptions', 'Active subscriptions'], ['scheduledSubscriptions', 'Scheduled terms'], ['expiredSubscriptions', 'Expired terms']].map(([key, label]) => <div className="card" key={key}><span className="small muted">{label}</span><strong>{overview?.[key] ?? '—'}</strong></div>)}
    </section>
    {overview && <p className="small muted">Membership status as of {financeDate(overview.asOf)} · {overview.timezone}</p>}
    <section aria-labelledby="finance-features"><h2 id="finance-features" className="finance-section-title">Your finance tools</h2><p className="muted">Choose a tool below to manage it, or follow the access guide to find it later.</p>
      <div className="finance-feature-grid">{FINANCE_FEATURES.map(feature => <article className="card finance-feature" key={feature.id}>
        <div className="finance-feature-top"><span className="finance-step"><Icon name={feature.icon || { plans: 'priceTag', subscriptions: 'calendar', renewals: 'bell' }[feature.id]} size={24} /></span><span className="tag acc">Available</span></div>
        <h3>{feature.title}</h3><p className="muted">{feature.description}</p><ul>{feature.features.map(text => <li key={text}>{text}</li>)}</ul>
        <div className="finance-access"><span className="finance-eyebrow">HOW TO ACCESS</span><p>{feature.access}</p></div><p className="small muted">{feature.tip}</p>
        <Link className="btn primary" to={feature.route}>{feature.action}<Icon name="chevronRight" /></Link>
      </article>)}</div>
    </section>
    <section className="card finance-guide" aria-labelledby="finance-guide"><h2 id="finance-guide">Start with these three steps</h2><ol>
      <li><strong>Set your prices.</strong> Create separate plans for one month, three months and one year. Enter the full price for each term.</li>
      <li><strong>Choose a member.</strong> Create or enable their client account in <Link to="/admin?section=members">Admin → Members</Link>.</li>
      <li><strong>Add their subscription.</strong> Select the period, matching plan and start date. The end date and status are calculated for you.</li>
    </ol></section>
    <aside className="card finance-note"><h2>Cash accounting</h2><p>Record actual money received in Revenue and money paid in Expenses. Profit &amp; loss subtracts posted expenses from posted revenue for the chosen period. USD and LBP stay separate. Marking a subscription Paid automatically creates a linked revenue entry for its full price.</p><h2>What a subscription records</h2><p>Subscriptions record membership coverage and the agreed price. They do not renew or charge automatically. Payment status is reviewed manually in the renewal tracker. Payment processing, partial payments, invoices and receipts are not available yet.</p><p className="small muted">Finance pages and their data are restricted to admins. Trainers and clients cannot access them.</p></aside>
  </main>
}
