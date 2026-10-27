import AccountEditor from '../components/AccountEditor.jsx'
import FilterPanel from '../components/FilterPanel.jsx'
import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { legacyAdminPath } from '../lib/routing.js'
import { needsActivation } from '../lib/activation.js'
import { fmtDate } from '../lib/format.js'
import { FINANCE_FEATURES } from '../lib/finance.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

// Staff dashboard; admin-only user management is also guarded server-side.
// Deliberately English-only — it isn't part of the translated end-user surface, so it stays
// out of the per-language string packs.

const userTypes = { all: 'All users', client: 'Clients', trainer: 'Trainers', admin: 'Admins' }

const rel = ts => {
  if (!ts) return 'never'
  const s = Math.max(0, (Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}
const dur = ms => { const m = Math.max(0, Math.floor(ms / 60000)); return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h' + (m % 60) + 'm' }

function DashboardTool({ to, icon, title, description, meta, featured = false }) {
  return <Link to={to} className={'admin-tool' + (featured ? ' admin-tool-featured' : '')}>
    <span className="admin-tool-icon"><Icon name={icon} size={24} /></span>
    <span className="admin-tool-content"><span className="admin-tool-title">{title}</span><span className="admin-tool-description">{description}</span>{meta && <span className="admin-tool-meta">{meta}</span>}</span>
    <Icon name="chevronRight" className="admin-tool-arrow" />
  </Link>
}

export default function Admin({ section = 'overview' }) {
  const user = useStore(s => s.user)
  const toast = useUI(s => s.toast)
  const isAdmin = user?.role === 'admin'
  const [creating, setCreating] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [users, setUsers] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const legacyPath = section === 'overview' || searchParams.has('section') ? legacyAdminPath(searchParams, isAdmin) : null
  useEffect(() => { window.scrollTo(0, 0) }, [section])
  const sectionTitle = { members: isAdmin ? 'Members & staff' : 'Clients', activity: 'Training activity' }[section]
  const search = searchParams.get('q') || ''
  const requestedRole = searchParams.get('role')
  const role = isAdmin && ['client', 'trainer', 'admin'].includes(requestedRole) ? requestedRole : 'all'
  const setRole = value => setSearchParams(params => {
    if (value === 'all') params.delete('role')
    else params.set('role', value)
    return params
  }, { replace: true })
  const setSearch = value => setSearchParams(params => {
    if (value) params.set('q', value)
    else params.delete('q')
    return params
  }, { replace: true })

  const loadUsers = () => api('/api/admin/users').then(d => { setUsers(d.users) }).catch(e => toast(e.message || 'Failed to load'))
  // poll every 15s so the "training now" section stays live without a manual refresh
  useEffect(() => { if (!user?.admin) return; loadUsers(); const iv = setInterval(loadUsers, 15000); return () => clearInterval(iv) }, [])
  if (!user?.admin) return null
  if (legacyPath) return <Navigate to={legacyPath} replace />

  const liveUsers = (users || []).filter(u => u.live)
  const activeCount = (users || []).filter(u => u.lastSync && Date.now() - u.lastSync < 7 * 86400000).length
  const pendingCount = (users || []).filter(u => needsActivation(u) && !u.disabled).length
  const visibleUsers = (users || [])
    .filter(u => role === 'all' || u.role === role)
    .filter(u => [u.name, u.email, u.role].some(value => value?.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())))
    .sort((a, b) => {
      const aPending = needsActivation(a) && !a.disabled
      const bPending = needsActivation(b) && !b.disabled
      if (aPending !== bPending) return aPending ? -1 : 1
      if (aPending) {
        const newestFirst = (Date.parse(b.created) || 0) - (Date.parse(a.created) || 0)
        if (newestFirst) return newestFirst
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })

  return <main className="admin-workspace">
    {section !== 'overview' && <Link className="admin-back" to="/admin"><Icon name="chevronLeft" />Back to dashboard</Link>}
    <div className="hdr admin-hdr">
      <div className="admin-title"><p className="admin-eyebrow">{isAdmin ? 'ADMIN WORKSPACE' : 'TRAINER WORKSPACE'}</p><h1>{sectionTitle || (isAdmin ? 'Admin dashboard' : 'Trainer dashboard')}</h1>
        <p className="admin-intro">{section === 'overview' ? 'Your gym, organised. Choose a tool to get started.' : section === 'members' ? (isAdmin ? 'Manage accounts, activation and training profiles.' : 'Manage client activation and training profiles.') : 'See who is training and open their workout profile.'}</p></div>
      <button className="iconbtn admin-refresh" onClick={loadUsers} aria-label="Refresh dashboard"><Icon name="reset" /></button>
    </div>

    <section className="admin-metrics" aria-label="Gym overview">
      <div className="tile"><div className="l">{isAdmin ? 'Total accounts' : 'Clients'}</div><div className="v">{users ? users.length : '—'}</div></div>
      <div className="tile"><div className="l">Training now</div><div className="v" style={{ color: liveUsers.length ? 'var(--acc)' : undefined }}>{users ? liveUsers.length : '—'}</div></div>
      <div className="tile"><div className="l">Active 7d</div><div className="v">{users ? activeCount : '—'}</div></div>
      <div className="tile"><div className="l">Awaiting activation</div><div className="v">{users ? pendingCount : '—'}</div></div>
    </section>

    {section === 'overview' && <nav aria-label="Dashboard tools" className="admin-menu">
      <section aria-labelledby="admin-people-title">
        <div className="admin-section-heading"><h2 id="admin-people-title">{isAdmin ? 'Gym management' : 'Client management'}</h2><p>People, access and daily activity</p></div>
        <div className="admin-menu-grid">
          <DashboardTool to="/admin/members" icon="people" title={isAdmin ? 'Accounts & staff' : 'Clients'} description={isAdmin ? 'Manage members, trainers and admin accounts.' : 'View clients and manage their training.'} meta={users ? `${users.length} accounts · ${pendingCount} pending activation` : 'Loading accounts…'} />
          <DashboardTool to="/admin/activity" icon="figureStrength" title="Training activity" description="Follow live workouts and open member profiles." meta={users ? `${liveUsers.length} training now · ${activeCount} active this week` : 'Loading activity…'} />
        </div>
      </section>
      {isAdmin && <section aria-labelledby="admin-finance-title">
        <div className="admin-section-heading"><h2 id="admin-finance-title">Finance</h2><p>Pricing, membership coverage and renewal follow-ups</p></div>
        <div className="admin-menu-grid">
          <DashboardTool to="/admin/finance" icon="wallet" title="Finance" description="Open the finance overview and step-by-step guides." featured />
          {FINANCE_FEATURES.map(feature => <DashboardTool key={feature.id} to={feature.route} icon={feature.icon || { plans: 'priceTag', subscriptions: 'calendar', renewals: 'bell' }[feature.id]} title={feature.title} description={feature.description} />)}
        </div>
      </section>}
    </nav>}


    {section === 'activity' && <section aria-label="Live workouts">
    {!users && <div className="card" role="status">Loading training activity…</div>}
    {users && !liveUsers.length && <div className="card admin-empty"><Icon name="dumbbell" size={32} /><h2>No workouts in progress</h2><p>Live sessions appear here when members start training.</p></div>}
    {liveUsers.length > 0 && <div className="card" style={{ borderColor: 'var(--acc)' }}>
      <h2 className="row" style={{ margin: '0 0 8px', gap: 6 }}><Icon name="dot" style={{ fontSize: 10, color: 'var(--green)' }} />Training now</h2>
      {liveUsers.map(u => <Link key={u.id} to={'/admin/clients/' + encodeURIComponent(u.id)} state={{ fromTrainer: true }} className="row between admin-client-link" style={{ padding: '8px 2px', borderBottom: '1px solid var(--sep)' }}>
        <div><div className="small" style={{ fontWeight: 600 }}>{u.name}</div>
          <div className="dim" style={{ fontSize: '.72rem' }}>{u.live.name} · ex {u.live.exIdx}/{u.live.exTotal} · {u.live.setsDone}/{u.live.setsTotal} sets</div></div>
        <span className="tag acc">{dur(Date.now() - u.live.startedAt)}</span>
      </Link>)}
    </div>}

    </section>}

    {section === 'members' && <section aria-labelledby="admin-member-title">
    <div className="admin-member-heading"><h2 id="admin-member-title">{isAdmin ? 'All users' : 'Clients'}</h2>

    {isAdmin && <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Create user</Button>}
    </div>
    {creating && isAdmin && <AccountEditor onCancel={() => setCreating(false)} onSaved={() => { setCreating(false); toast('User created'); loadUsers() }} />}
    <div className="renewal-search-toolbar admin-user-filters">
    <div className="admin-search">
      <Icon name="magnifier" />
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder={isAdmin ? 'Search name, email or role' : 'Search clients'} aria-label="Search users" />
      {search && <button onClick={() => setSearch('')} aria-label="Clear search"><Icon name="xmark" /></button>}
    </div>
    {isAdmin && <button type="button" className={'renewal-filter-trigger' + (role !== 'all' ? ' is-active' : '')} aria-label={role === 'all' ? 'Filter users by type' : `Filter users: ${userTypes[role]}`} aria-haspopup="dialog" aria-expanded={filtersOpen} disabled={!users} onClick={() => setFiltersOpen(true)}><Icon name="filter" size={20} />{role !== 'all' && <span className="renewal-filter-indicator" />}</button>}
    </div>
    {users && <div className="renewal-list-meta"><span role="status">{visibleUsers.length} of {users.length} users{role !== 'all' ? ` · ${userTypes[role]}` : ''}</span>{role !== 'all' && <button type="button" onClick={() => setRole('all')}>Clear filter</button>}</div>}
    {!users && <p className="card" role="status">Loading accounts…</p>}
    <div className="list">
      {visibleUsers.map(u => <Link key={u.id} to={'/admin/clients/' + encodeURIComponent(u.id)} state={{ fromTrainer: true }} className="item admin-client-link" style={u.disabled ? { opacity: .55 } : null}>
          <div className="grow"><div className="tt">{u.live && <Icon name="dot" style={{ fontSize: 9, color: 'var(--green)', display: 'inline-block', marginRight: 5 }} />}{u.name} {needsActivation(u) && !u.disabled && <span className="tag acc">Pending activation</span>}{u.admin && <span className="tag acc" style={{ marginLeft: 4 }}>{u.role}</span>}{u.disabled && <span className="tag" style={{ marginLeft: 4, color: 'var(--red)' }}>off</span>}</div>
          <div className="ss">{u.live ? 'training now · ' + u.live.name : u.workouts + ' workouts' + (u.lastWorkout ? ' · last ' + fmtDate(u.lastWorkout) : '') + ' · synced ' + rel(u.lastSync)}</div></div>
        {u.hasPush && <Icon name="bell" title="push enabled" style={{ fontSize: 15, color: 'var(--label-3)' }} />}<Icon name="chevronRight" className="chev" />
      </Link>)}
      {users && !users.length && <div className="empty">No users yet.</div>}
      {users && users.length > 0 && !visibleUsers.length && <div className="empty small">No matching accounts.</div>}
    </div>
    {isAdmin && filtersOpen && <FilterPanel title="Filter users" legend="User type" applyLabel="Show users" value={role} options={Object.entries(userTypes).map(([value, label]) => ({ value, label, count: value === 'all' ? (users || []).length : (users || []).filter(account => account.role === value).length }))} onApply={value => { setRole(value); setFiltersOpen(false) }} onClose={() => setFiltersOpen(false)} />}
    </section>}
  </main>
}
