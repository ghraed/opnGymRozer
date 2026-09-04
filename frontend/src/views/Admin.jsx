import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { fmtDate, fmtNum, fmtVol, fmtDur } from '../lib/format.js'
import { workoutVolume, setsDone } from '../lib/history.js'
import { confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import LineChart from '../components/LineChart.jsx'
import { EXDB, EXIDX } from '../lib/exercises.js'
import { estimate1RM } from '../lib/onerm.js'

// Admin-only operator dashboard (owner session + admin flag; guarded again server-side).
// Deliberately English-only — it isn't part of the translated end-user surface, so it stays
// out of the per-language string packs.

const rel = ts => {
  if (!ts) return 'never'
  const s = Math.max(0, (Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}
const dur = ms => { const m = Math.max(0, Math.floor(ms / 60000)); return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h' + (m % 60) + 'm' }

const clone = value => JSON.parse(JSON.stringify(value))
const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

// The native select used here made a catalogue of thousands of movements hard to
// navigate. Keep this picker local to the trainer editor: it searches the same
// vetted exercise library clients use, plus exercises created for this client.
function TrainerExercisePicker({ customEx = [], onPick, inputId, close }) {
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(30)
  const needle = query.trim().toLowerCase()
  const exercises = useMemo(() => [...customEx, ...EXDB]
    .sort((a, b) => a.n.localeCompare(b.n))
    .filter(ex => !needle || [ex.n, ex.bp, ex.tg, ex.mg, ex.eq, ...(ex.sm || [])]
      .filter(Boolean).join(' ').toLowerCase().includes(needle)), [customEx, needle])

  return <div style={{ marginTop: 10 }}>
    <h3 style={{ marginBottom: 12 }}>Add exercise</h3>
    <label className="small" htmlFor={inputId} style={{ display: 'block', marginBottom: 5 }}>Exercise library</label>
    <div className="search">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      <input id={inputId} className="input" value={query} placeholder="Search exercise, muscle, or equipment…" onChange={e => { setQuery(e.target.value); setShown(30) }} />
    </div>
    <div className="small muted" style={{ margin: '7px 2px' }}>{exercises.length} professional exercises available</div>
    <div className="list" style={{ maxHeight: 310, overflowY: 'auto' }}>
      {exercises.slice(0, shown).map(ex => <button type="button" className="item" key={ex.id} onClick={() => { onPick(ex.id); close() }} style={{ width: '100%', textAlign: 'left', background: 'none' }}>
        <div className="thumb thumb-x"><Icon name="dumbbell" /></div>
        <div className="grow"><div className="tt capitalize">{ex.n}</div><div className="ss capitalize">{ex.tg || ex.bp} · {ex.eq}</div></div>
        <Icon name="plus" className="chev" />
      </button>)}
      {!exercises.length && <div className="empty small">No exercises match that search.</div>}
    </div>
    {exercises.length > shown && <Button size="sm" style={{ marginTop: 8 }} onClick={() => setShown(n => n + 30)}>Show more</Button>}
  </div>
}

function TrainerPlanEditor({ detail, onSaved, onCancel }) {
  const [plan, setPlan] = useState(() => clone(detail.plan))
  const [saving, setSaving] = useState(false)
  const toast = useUI(s => s.toast)
  const updateRoutine = (index, fn) => setPlan(p => { const n = clone(p); fn(n.routines[index]); return n })
  const addRoutine = () => setPlan(p => ({ ...p, routines: [...p.routines, { id: makeId(), name: 'New routine', emoji: 'dumbbell', ex: [] }] }))
  const addCustom = () => {
    const name = window.prompt('Custom exercise name')?.trim()
    if (!name) return
    const bodyPart = window.prompt('Body part', 'other')?.trim() || 'other'
    setPlan(p => ({ ...p, customEx: [...(p.customEx || []), { id: 'custom-' + makeId(), n: name, bp: bodyPart, tg: bodyPart, eq: 'custom', custom: true }] }))
  }
  const save = () => confirmSheet({
    title: 'Replace client plan?',
    message: `Save this plan for ${detail.user.name}? Their next sync will receive this trainer version.`,
    confirmText: 'Save plan',
    onConfirm: async () => {
      setSaving(true)
      try {
        const result = await api('/api/admin/client/plan', { method: 'PUT', body: JSON.stringify({ id: detail.user.id, plan, baseVersion: detail.revisions.plan }) })
        toast('Trainer plan saved'); onSaved(result)
      } catch (e) { toast(e.message) } finally { setSaving(false) }
    }
  })
  return <div>
    <div className="row between"><h3 style={{ margin: 0 }}>Editing {detail.user.name}'s plan</h3><span className="tag acc">isolated editor</span></div>
    <div className="small muted" style={{ margin: '7px 0 14px' }}>Changes affect this client only. Workout history and weigh-ins are read-only.</div>
    {(plan.routines || []).map((routine, ri) => <div className="card" key={routine.id} style={{ marginBottom: 10 }}>
      <div className="row" style={{ gap: 8 }}>
        <input className="input" value={routine.name} aria-label="Routine name" onChange={e => updateRoutine(ri, r => { r.name = e.target.value })} />
        <button className="iconbtn" aria-label="Delete routine" onClick={() => setPlan(p => ({ ...p, routines: p.routines.filter((_, i) => i !== ri) }))}><Icon name="trash" /></button>
      </div>
      <div className="list" style={{ marginTop: 8 }}>
        {(routine.ex || []).map((entry, ei) => <div key={entry.id + '-' + ei} style={{ padding: '8px 0', borderBottom: '1px solid var(--sep)' }}>
          <div className="row between"><span className="small capitalize" style={{ fontWeight: 600 }}>{EXIDX[entry.id]?.n || (plan.customEx || []).find(e => e.id === entry.id)?.n || entry.id}</span>
            <button className="iconbtn" aria-label="Remove exercise" onClick={() => updateRoutine(ri, r => { r.ex.splice(ei, 1) })}><Icon name="trash" /></button></div>
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            {['sets', 'reps', 'weight'].map(field => <label className="small" style={{ flex: 1 }} key={field}>{field}<input className="input" type="number" min="0" step={field === 'weight' ? '.5' : '1'} value={entry[field] ?? (field === 'weight' ? 0 : field === 'sets' ? 3 : 10)} onChange={e => updateRoutine(ri, r => { r.ex[ei][field] = +e.target.value })} /></label>)}
          </div>
        </div>)}
      </div>
      <Button icon="plus" style={{ marginTop: 10 }} onClick={() => useUI.getState().openSheet(close => <TrainerExercisePicker
        inputId={'trainer-exercise-search-' + routine.id}
        customEx={plan.customEx || []}
        close={close}
        onPick={id => updateRoutine(ri, r => { r.ex.push({ id, sets: 3, mode: 'reps', reps: 10, weight: 0 }) })}
      />)}>Add exercise</Button>
    </div>)}
    <div className="row" style={{ gap: 8, marginTop: 10 }}><Button onClick={addRoutine} icon="plus">Routine</Button><Button onClick={addCustom} icon="plus">Custom exercise</Button></div>
    <div className="row" style={{ gap: 8, marginTop: 14 }}><Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save trainer plan'}</Button><Button onClick={onCancel}>Cancel</Button></div>
  </div>
}

function performanceRows(workouts) {
  const best = new Map()
  for (const workout of workouts) for (const entry of workout.entries || []) for (const set of entry.sets || []) {
    if (!set.done) continue
    const estimate = estimate1RM(set.w, set.r)
    const current = best.get(entry.id)
    if (estimate && (!current || estimate > current.estimate)) best.set(entry.id, { id: entry.id, estimate, weight: +set.w || 0, reps: +set.r || 0, date: workout.d })
  }
  return [...best.values()].sort((a, b) => b.estimate - a.estimate).slice(0, 12)
}

function UserDetail({ id, onChanged, close }) {
  const [d, setD] = useState(null)
  const [editing, setEditing] = useState(false)
  const toast = useUI(s => s.toast)
  const load = () => api('/api/admin/user?id=' + encodeURIComponent(id)).then(setD).catch(e => toast(e.message))
  useEffect(() => { load() }, [id])
  if (!d) return <div className="muted small">Loading…</div>
  if (editing) return <TrainerPlanEditor detail={d} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); load(); onChanged() }} />
  const u = d.user
  const setDisabled = disabled => {
    api('/api/admin/user/disable', { method: 'POST', body: JSON.stringify({ id: u.id, disabled }) })
      .then(() => { toast(disabled ? 'User disabled' : 'User enabled'); onChanged(); close() })
      .catch(e => toast(e.message))
  }
  const setRole = role => api('/api/admin/user/role', { method: 'POST', body: JSON.stringify({ id: u.id, role }) })
    .then(() => { toast(role === 'trainer' ? 'Trainer access granted' : 'Trainer access removed'); onChanged(); load() }).catch(e => toast(e.message))
  const weightPoints = d.bodyweight.map(x => ({ t: new Date(x.d + 'T12:00:00').getTime(), d: x.d, y: +x.w }))
  const performance = performanceRows(d.workouts)
  return <>
    <h3 className="capitalize">{u.name}</h3>
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '8px 0 12px' }}>
      {u.admin && <span className="tag acc">trainer</span>}
      {u.disabled && <span className="tag" style={{ color: 'var(--red)' }}>disabled</span>}
      {u.invitedBy && <span className="tag">invite {u.invitedBy}</span>}
      <span className="tag">joined {u.created ? fmtDate(u.created.slice(0, 10)) : '—'}</span>
    </div>
    {!u.admin && <Button variant="primary" onClick={() => setEditing(true)} icon="pencil">Edit client plan</Button>}
    <div className="row" style={{ gap: 8, marginTop: 8 }}>
      {!u.admin && <Button size="sm" onClick={() => setRole('trainer')}>Promote to trainer</Button>}
      {u.admin && <Button size="sm" variant="danger" onClick={() => setRole('client')}>Demote to client</Button>}
    </div>
    <div className="tiles" style={{ textAlign: 'left' }}>
      <div className="tile"><div className="l">Workouts</div><div className="v" style={{ fontSize: '1.1rem' }}>{d.workouts.length}</div></div>
      <div className="tile"><div className="l">Weigh-ins</div><div className="v" style={{ fontSize: '1.1rem' }}>{d.bodyweight.length}</div></div>
      <div className="tile"><div className="l">Routines</div><div className="v" style={{ fontSize: '1.1rem' }}>{d.routines.length}</div></div>
      <div className="tile"><div className="l">Last sync</div><div className="v" style={{ fontSize: '.95rem' }}>{rel(d.lastSync)}</div></div>
    </div>
    {!u.admin && <button className={'btn ' + (u.disabled ? 'primary' : 'danger')} style={{ margin: '12px 0 4px' }}
      onClick={() => u.disabled ? setDisabled(false)
        : confirmSheet({ title: 'Disable ' + u.name + '?', message: 'They are signed out everywhere and can no longer sync or log in until re-enabled.', confirmText: 'Disable', danger: true, onConfirm: () => setDisabled(true) })}>
      {u.disabled ? 'Enable account' : 'Disable account'}</button>}
    <h4 className="sec">Body-weight progress</h4>
    <div className="card"><LineChart points={weightPoints} unit={d.unit} goal={null} /></div>
    <h4 className="sec">Exercise performance</h4>
    {performance.length ? <div className="list">{performance.map(p => <div className="item" key={p.id}>
      <div className="grow"><div className="tt capitalize">{EXIDX[p.id]?.n || p.id}</div><div className="ss">{p.weight} {d.unit} × {p.reps} · {fmtDate(p.date, true)}</div></div>
      <span className="tag acc">e1RM {fmtNum(p.estimate)} {d.unit}</span>
    </div>)}</div> : <div className="empty small">No eligible completed sets yet.</div>}
    <h4 className="sec">Current plan</h4>
    {d.routines.length ? <div className="list">{d.routines.map(r => <div className="item" key={r.id}><div className="grow"><div className="tt">{r.name}</div><div className="ss">{(r.ex || []).length} exercises</div></div></div>)}</div> : <div className="empty small">No routines yet.</div>}
    <h4 className="sec">Workout history</h4>
    {d.workouts.length ? <div className="list" style={{ gap: 0 }}>
      {d.workouts.slice(0, 60).map(w => <div key={w.id} className="row between" style={{ padding: '9px 2px', borderBottom: '1px solid var(--sep)' }}>
        <div><div className="small" style={{ fontWeight: 600 }}>{w.name}</div>
          <div className="dim" style={{ fontSize: '.72rem' }}>{fmtDate(w.d, true)} · {fmtDur((w.end || w.start) - w.start)} · {setsDone(w)} sets{w.prs?.length ? ' · ' + w.prs.length + ' PR' : ''}</div></div>
        <span className="small muted">{fmtVol(w.vol ?? workoutVolume(w), d.unit)}</span>
      </div>)}
    </div> : <div className="empty small">No workouts logged.</div>}
  </>
}

function InvitesCard({ invites, reload }) {
  const toast = useUI(s => s.toast)
  const gen = () => api('/api/admin/invites/new', { method: 'POST', body: '{}' })
    .then(({ invite }) => { navigator.clipboard?.writeText(invite.code).catch(() => {}); toast('Code ' + invite.code + ' created & copied'); reload() })
    .catch(e => toast(e.message))
  const revoke = code => api('/api/admin/invites/revoke', { method: 'POST', body: JSON.stringify({ code }) })
    .then(() => { toast('Code revoked'); reload() }).catch(e => toast(e.message))
  const open = (invites || []).filter(i => !i.usedBy)
  const used = (invites || []).filter(i => i.usedBy)
  return <div className="card">
    <div className="row between"><h2 style={{ margin: 0 }}>Invite codes</h2>
      <Button variant="primary" size="sm" onClick={gen} icon="plus">Generate</Button></div>
    <div className="small muted" style={{ margin: '6px 0 10px' }}>{open.length} unused · {used.length} redeemed</div>
    {open.map(i => <div key={i.code} className="row between" style={{ padding: '7px 2px', borderBottom: '1px solid var(--sep)' }}>
      <span style={{ fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontWeight: 500, letterSpacing: '.06em' }}
        onClick={() => { navigator.clipboard?.writeText(i.code).catch(() => {}); toast('Copied ' + i.code) }}>{i.code}</span>
      <button className="iconbtn" style={{ width: 32, height: 30, borderRadius: 8, fontSize: 15, color: 'var(--red)' }} onClick={() => revoke(i.code)} aria-label="revoke"><Icon name="trash" /></button>
    </div>)}
    {used.map(i => <div key={i.code} className="row between dim" style={{ padding: '7px 2px', fontSize: '.8rem' }}>
      <span style={{ fontFamily: 'monospace' }}>{i.code}</span><span>→ {i.usedByName || 'used'}</span>
    </div>)}
    {!open.length && !used.length && <div className="dim small">No codes yet — generate one to invite someone.</div>}
  </div>
}

export default function Admin() {
  const user = useStore(s => s.user)
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)
  const [users, setUsers] = useState(null)
  const [invites, setInvites] = useState(null)
  const [inviteOnly, setInviteOnly] = useState(false)
  const [search, setSearch] = useState('')

  const loadUsers = () => api('/api/admin/users').then(d => { setUsers(d.users); setInviteOnly(d.invite_only) }).catch(e => toast(e.message || 'Failed to load'))
  const loadInvites = () => api('/api/admin/invites').then(d => setInvites(d.invites)).catch(() => {})
  // poll every 15s so the "training now" section stays live without a manual refresh
  useEffect(() => { if (!user?.admin) return; loadUsers(); loadInvites(); const iv = setInterval(loadUsers, 15000); return () => clearInterval(iv) }, [])
  if (!user?.admin) return null

  const openUser = id => openSheet(close => <UserDetail id={id} onChanged={loadUsers} close={close} />)
  const liveUsers = (users || []).filter(u => u.live)
  const activeCount = (users || []).filter(u => u.lastSync && Date.now() - u.lastSync < 7 * 86400000).length
  const disabledCount = (users || []).filter(u => u.disabled).length
  const visibleUsers = (users || []).filter(u => u.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))

  return <div className="narrow">
    <div className="hdr admin-hdr">
      <div className="admin-title"><h1>Trainer dashboard</h1>
        <div className="sub">{users ? users.length + ' users · ' + activeCount + ' active this week' : 'Loading…'}</div></div>
      <button className="iconbtn" onClick={() => { loadUsers(); loadInvites() }} aria-label="refresh">↻</button>
    </div>

    <div className="tiles" style={{ marginBottom: 12 }}>
      <div className="tile"><div className="l">Users</div><div className="v">{users ? users.length : '—'}</div></div>
      <div className="tile"><div className="l">Training now</div><div className="v" style={{ color: liveUsers.length ? 'var(--acc)' : undefined }}>{users ? liveUsers.length : '—'}</div></div>
      <div className="tile"><div className="l">Active 7d</div><div className="v">{users ? activeCount : '—'}</div></div>
      <div className="tile"><div className="l">Disabled</div><div className="v">{users ? disabledCount : '—'}</div></div>
    </div>

    {liveUsers.length > 0 && <div className="card" style={{ borderColor: 'var(--acc)' }}>
      <h2 className="row" style={{ margin: '0 0 8px', gap: 6 }}><Icon name="dot" style={{ fontSize: 10, color: 'var(--green)' }} />Training now</h2>
      {liveUsers.map(u => <div key={u.id} className="row between" style={{ padding: '8px 2px', borderBottom: '1px solid var(--sep)' }} onClick={() => openUser(u.id)}>
        <div><div className="small" style={{ fontWeight: 600 }}>{u.name}</div>
          <div className="dim" style={{ fontSize: '.72rem' }}>{u.live.name} · ex {u.live.exIdx}/{u.live.exTotal} · {u.live.setsDone}/{u.live.setsTotal} sets</div></div>
        <span className="tag acc">{dur(Date.now() - u.live.startedAt)}</span>
      </div>)}
    </div>}

    <InvitesCard invites={invites} reload={loadInvites} />

    <h4 className="sec">Clients</h4>
    <div className="admin-search">
      <Icon name="magnifier" />
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients" aria-label="Search clients" />
      {search && <button onClick={() => setSearch('')} aria-label="Clear search"><Icon name="xmark" /></button>}
    </div>
    <div className="list">
      {visibleUsers.map(u => <div key={u.id} className="item" onClick={() => openUser(u.id)} style={u.disabled ? { opacity: .55 } : null}>
          <div className="grow"><div className="tt">{u.live && <Icon name="dot" style={{ fontSize: 9, color: 'var(--green)', display: 'inline-block', marginRight: 5 }} />}{u.name} {u.admin && <span className="tag acc" style={{ marginLeft: 4 }}>trainer</span>}{u.disabled && <span className="tag" style={{ marginLeft: 4, color: 'var(--red)' }}>off</span>}</div>
          <div className="ss">{u.live ? 'training now · ' + u.live.name : u.workouts + ' workouts' + (u.lastWorkout ? ' · last ' + fmtDate(u.lastWorkout) : '') + ' · synced ' + rel(u.lastSync)}</div></div>
        {u.hasPush && <Icon name="bell" title="push enabled" style={{ fontSize: 15, color: 'var(--label-3)' }} />}<Icon name="chevronRight" className="chev" />
      </div>)}
      {users && !users.length && <div className="empty">No users yet.</div>}
      {users && users.length > 0 && !visibleUsers.length && <div className="empty small">No matching clients.</div>}
    </div>
  </div>
}
