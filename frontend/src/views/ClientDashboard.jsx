import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { needsActivation } from '../lib/activation.js'
import { api } from '../lib/api.js'
import { fmtDate, fmtNum, fmtVol, fmtDur } from '../lib/format.js'
import { workoutVolume, setsDone } from '../lib/history.js'
import { confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { ProfileAvatar } from '../components/ProfilePhoto.jsx'
import { Button, NumberField } from '../components/ui.jsx'
import ExercisePreview from '../components/ExercisePreview.jsx'
import { Thumb } from '../components/Media.jsx'
import LineChart from '../components/LineChart.jsx'
import { EXDB, EXIDX } from '../lib/exercises.js'
import { estimate1RM } from '../lib/onerm.js'

const rel = ts => {
  if (!ts) return 'never'
  const s = Math.max(0, (Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}

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
    <div className="small muted" style={{ margin: '7px 2px' }}>{exercises.length} exercises available</div>
    <div className="list" style={{ maxHeight: 310, overflowY: 'auto' }}>
      {exercises.slice(0, shown).map(ex => <button type="button" className="item" key={ex.id} onClick={() => { onPick(ex.id); close() }} style={{ width: '100%', textAlign: 'left', background: 'none' }}>
        <Thumb ex={ex} />
        <div className="grow"><div className="tt capitalize">{ex.n}</div><div className="ss capitalize">{ex.tg || ex.bp} · {ex.eq}</div></div>
        <Icon name="plus" className="chev" />
      </button>)}
      {!exercises.length && <div className="empty small">No exercises match that search.</div>}
    </div>
    {exercises.length > shown && <Button size="sm" style={{ marginTop: 8 }} onClick={() => setShown(n => n + 30)}>Show more</Button>}
  </div>
}

export function TrainerPlanEditor({ detail, onSaved, onCancel }) {
  const [plan, setPlan] = useState(() => clone(detail.plan))
  const [saving, setSaving] = useState(false)
  const [customDraft, setCustomDraft] = useState(null)
  const toast = useUI(s => s.toast)
  const updateRoutine = (index, fn) => setPlan(p => { const n = clone(p); fn(n.routines[index]); return n })
  const addRoutine = () => setPlan(p => ({ ...p, routines: [...p.routines, { id: makeId(), name: 'New routine', emoji: 'dumbbell', ex: [] }] }))
  const addCustom = () => {
    const name = customDraft?.name.trim()
    if (!name) return
    const bodyPart = customDraft.bodyPart.trim() || 'other'
    setPlan(p => ({ ...p, customEx: [...(p.customEx || []), { id: 'custom-' + makeId(), n: name, bp: bodyPart, tg: bodyPart, eq: 'custom', custom: true }] }))
    setCustomDraft(null)
    toast('Custom exercise added to the library')
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
  const exerciseFor = id => (plan.customEx || []).find(ex => ex.id === id) || EXIDX[id] || { id, n: 'Unknown exercise', eq: '', tg: '' }
  const changeField = (ri, ei, field, value) => updateRoutine(ri, routine => {
    const entry = routine.ex[ei]
    entry[field] = value
    if (field === 'reps' && entry.repsMin > value) entry.repsMin = value
    if (field === 'repsMin' && value > entry.reps) entry.reps = value
  })
  const picker = (ri, replaceIndex = null) => useUI.getState().openSheet(close => <TrainerExercisePicker
    inputId={'trainer-exercise-search-' + plan.routines[ri].id}
    customEx={plan.customEx || []} close={close}
    onPick={id => updateRoutine(ri, routine => {
      const exercise = exerciseFor(id)
      const entry = exercise.bp === 'cardio' ? { id, sets: 1, mode: 'cardio', min: 20, speed: 0 }
        : { id, sets: 3, mode: 'reps', reps: 10, weight: 0 }
      if (replaceIndex === null) routine.ex.push(entry)
      else routine.ex[replaceIndex] = entry
    })}
  />)
  const removeRoutine = ri => setPlan(current => {
    const id = current.routines[ri].id
    return { ...current, routines: current.routines.filter((_, i) => i !== ri),
      week: Object.fromEntries(Object.entries(current.week || {}).filter(([, routineId]) => routineId !== id)),
      dayPlan: Object.fromEntries(Object.entries(current.dayPlan || {}).filter(([, routineId]) => routineId !== id)) }
  })
  return <div className="trainer-plan-editor">
    <div className="trainer-plan-intro"><div><h2>{detail.user.name}'s training plan</h2><p className="muted">Review the demonstrations and adjust each exercise before saving.</p></div>
      <span className="tag acc">{plan.routines.length} routines</span></div>
    <fieldset className="trainer-plan-fields" disabled={saving}>
    {(plan.routines || []).map((routine, ri) => <details className="card trainer-routine-card" key={routine.id} open={ri === 0}>
      <summary><span className="trainer-routine-number">{String(ri + 1).padStart(2, '0')}</span><span className="grow"><strong>{routine.name || 'Untitled routine'}</strong><small>{routine.ex.length} exercises · {routine.ex.filter(e => e.mode !== 'cardio').reduce((total, e) => total + (e.sets || 0), 0)} working sets</small></span><Icon name="chevronDown" /></summary>
      <div className="trainer-routine-body">
        <div className="trainer-routine-heading"><label>Routine name<input className="input" value={routine.name} onChange={e => updateRoutine(ri, r => { r.name = e.target.value })} /></label>
          <button type="button" className="iconbtn trainer-remove" aria-label={`Delete ${routine.name} routine`} onClick={() => removeRoutine(ri)}><Icon name="trash" /></button></div>
        <div className="trainer-exercise-list">
        {(routine.ex || []).map((entry, ei) => {
          const exercise = exerciseFor(entry.id)
          const mode = entry.mode || (exercise.bp === 'cardio' ? 'cardio' : 'reps')
          const fields = mode === 'cardio' ? [['min', 'Duration (min)', 20, true], ['speed', 'Speed (km/h)', 0, true]]
            : [['sets', 'Sets', 3, false], ...(mode === 'time' ? [['sec', 'Hold (sec)', 45, false]]
              : [...(entry.repsMin ? [['repsMin', 'Min reps', entry.repsMin, false]] : []), ['reps', entry.repsMin ? 'Max reps' : 'Reps', 10, false]]), ['weight', `Weight (${detail.unit || 'kg'})`, 0, true]]
          return <article className="trainer-exercise-card" key={entry.id + '-' + ei}>
            <div className="trainer-exercise-heading"><span className="trainer-exercise-order">{ei + 1}</span><div className="grow"><h3 className="capitalize">{exercise.n}</h3><p className="capitalize">{[exercise.tg || exercise.bp, exercise.eq].filter(Boolean).join(' · ')}</p></div>
              <button type="button" className="iconbtn trainer-remove" aria-label={`Remove ${exercise.n}`} onClick={() => updateRoutine(ri, r => { r.ex.splice(ei, 1) })}><Icon name="trash" /></button></div>
            <div className="trainer-exercise-content"><ExercisePreview exercise={exercise} />
              <div className="trainer-exercise-settings"><div className="trainer-exercise-fields">
                {fields.map(([field, label, fallback, decimal]) => <label key={field}>{label}<NumberField aria-label={`${exercise.n}: ${label}`} value={entry[field] ?? fallback} decimal={decimal}
                  onChange={value => changeField(ri, ei, field, ['weight', 'speed'].includes(field) ? value : Math.max(1, value))} /></label>)}
                {mode !== 'cardio' && <label>Rest (sec)<NumberField aria-label={`${exercise.n}: Rest (sec)`} value={entry.rest ?? null} placeholder="Client default" nullable decimal={false} onChange={value => changeField(ri, ei, 'rest', value == null ? null : Math.max(1, value))} /></label>}
              </div>
              <Button type="button" size="sm" className="trainer-replace" onClick={() => picker(ri, ei)}>Replace exercise</Button>
              {!!exercise.st?.length && <details className="trainer-exercise-instructions"><summary>Technique notes</summary><ol>{exercise.st.map((step, i) => <li key={i}>{step}</li>)}</ol></details>}
              </div>
            </div>
          </article>
        })}
        {!routine.ex.length && <div className="trainer-routine-empty"><Icon name="dumbbell" /><p>Add your first exercise to build this routine.</p></div>}
        </div>
        <Button type="button" icon="plus" className="trainer-add-exercise" onClick={() => picker(ri)}>Add exercise</Button>
      </div>
    </details>)}
    <div className="trainer-plan-tools"><Button type="button" onClick={addRoutine} icon="plus">Add routine</Button><Button type="button" onClick={() => setCustomDraft({ name: '', bodyPart: '' })} icon="plus">Custom exercise</Button></div>
    {customDraft && <section className="trainer-custom-form card"><h3>Create a custom exercise</h3><p className="small muted">Add it to this client's library, then choose it with Add exercise.</p>
      <label>Exercise name<input className="input" value={customDraft.name} onChange={event => setCustomDraft({ ...customDraft, name: event.target.value })} /></label>
      <label>Body part (optional)<input className="input" value={customDraft.bodyPart} onChange={event => setCustomDraft({ ...customDraft, bodyPart: event.target.value })} /></label>
      <div className="trainer-plan-tools"><Button type="button" onClick={() => setCustomDraft(null)}>Cancel</Button><Button type="button" variant="primary" onClick={addCustom} disabled={!customDraft.name.trim()}>Add to library</Button></div>
    </section>}
    </fieldset>
    <div className="trainer-plan-actions"><span className="small muted">Changes apply when you save.</span><div><Button type="button" onClick={onCancel} disabled={saving}>Cancel</Button><Button type="button" variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save plan'}</Button></div></div>
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

export default function ClientDashboard() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const viewer = useStore(s => s.user)
  const toast = useUI(s => s.toast)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [shown, setShown] = useState(10)
  const reload = () => setRevision(n => n + 1)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    api('/api/admin/user?id=' + encodeURIComponent(id), { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setDetail(data) })
      .catch(e => { if (!controller.signal.aborted) setError(e.status === 404 ? 'This client could not be found.' : e.message || 'Unable to load this client.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id, revision])

  const back = () => {
    if (editing) { setEditing(false); return }
    if (location.state?.fromTrainer) navigate(-1)
    else navigate('/admin')
  }
  const header = <header className="hdr client-header">
    <button className="iconbtn" onClick={back} aria-label={editing ? 'Back to client dashboard' : 'Back to clients'}><Icon name="chevronLeft" /></button>
    <div className="grow"><div className="small muted">Trainer / {editing ? 'Client plan' : 'Client overview'}</div><h1>{editing ? 'Edit plan' : 'Client dashboard'}</h1></div>
    {!editing && <button className="iconbtn" onClick={reload} disabled={loading || pending} aria-label="Refresh client dashboard">↻</button>}
  </header>

  if (!detail) return <main className="client-dashboard">{header}
    <div className="card client-state" role={error ? 'alert' : 'status'}>
      <h2>{error ? 'Unable to open client' : 'Loading client dashboard…'}</h2>
      {error && <><p className="muted">{error}</p><Button onClick={reload}>Try again</Button><Link to="/admin">Back to clients</Link></>}
    </div>
  </main>

  if (editing) return <main className="client-dashboard client-editor">{header}
    <TrainerPlanEditor detail={detail} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); reload() }} />
  </main>

  const u = detail.user
  const workouts = [...detail.workouts].sort((a, b) => b.d.localeCompare(a.d) || (b.start || 0) - (a.start || 0))
  const weightPoints = detail.bodyweight.map(x => ({ t: new Date(x.d + 'T12:00:00').getTime(), d: x.d, y: +x.w }))
    .filter(x => Number.isFinite(x.t) && Number.isFinite(x.y)).sort((a, b) => a.t - b.t)
  const latestWeight = weightPoints.at(-1)
  const weightChange = weightPoints.length > 1 ? latestWeight.y - weightPoints[0].y : null
  const performance = performanceRows(workouts)
  const exerciseName = id => detail.customEx?.find(ex => ex.id === id)?.n || EXIDX[id]?.n || id

  const changeAccount = async (path, body, message) => {
    setPending(true)
    try {
      await api(path, { method: 'POST', body: JSON.stringify({ id: u.id, ...body }) })
      toast(message)
      reload()
    } catch (e) { toast(e.message) } finally { setPending(false) }
  }
  const setDisabled = disabled => changeAccount('/api/admin/user/disable', { disabled }, disabled ? 'User disabled' : 'User enabled')
  const deleteAccount = async () => {
    setPending(true)
    try {
      await api('/api/admin/user', { method: 'DELETE', body: JSON.stringify({ id: u.id }) })
      toast('Client account deleted')
      navigate('/admin', { replace: true })
    } catch (e) { toast(e.message); setPending(false) }
  }
  const setRole = role => changeAccount('/api/admin/user/role', { role }, role === 'trainer' ? 'Trainer access granted' : 'Trainer access removed')

  return <main className="client-dashboard">{header}
    {error && <div className="card" role="alert"><p>{error}</p><Button size="sm" onClick={reload}>Try again</Button></div>}
    <section className="card client-profile" aria-labelledby="client-name">
      <div className="client-identity">
        <ProfileAvatar value={detail.profileImage} name={u.name} className="client-avatar" />
        <div className="grow"><h2 id="client-name" className="capitalize">{u.name}</h2>
          <div className="client-badges"><span className="tag acc">{u.admin ? 'Trainer' : 'Client'}</span><span className={'tag' + (u.disabled ? ' client-disabled' : '')}>{u.disabled ? 'Account disabled' : needsActivation(u) ? 'Pending activation' : 'Account active'}</span></div>
          <p className="small muted">{u.created ? 'Joined ' + fmtDate(u.created.slice(0, 10)) + ' · ' : ''}Synced {rel(detail.lastSync)}</p>
        </div>
      </div>
      {!u.admin && <Button variant="primary" icon="pencil" disabled={loading || pending} onClick={() => setEditing(true)}>Edit client plan</Button>}
    </section>

    {needsActivation(u) && !u.disabled && <section className="card client-activation" aria-labelledby="activation-title">
      <div><h2 id="activation-title">Waiting for activation</h2><p className="small muted">This client can sign in, but needs your approval to access their plan and log workouts.</p></div>
      <Button variant="primary" disabled={loading || pending} onClick={() => changeAccount('/api/admin/user/activate', {}, 'Client account activated')}>Activate account</Button>
    </section>}



    <dl className="client-metrics" aria-label="Client summary">
      <div className="card"><dt>Workouts</dt><dd>{workouts.length}</dd><p>{workouts[0] ? 'Latest ' + fmtDate(workouts[0].d, true) : 'No workouts yet'}</p></div>
      <div className="card"><dt>Body weight</dt><dd>{latestWeight ? fmtNum(latestWeight.y) : '—'}{latestWeight && <small> {detail.unit}</small>}</dd><p>{latestWeight ? 'Logged ' + fmtDate(latestWeight.d, true) : 'No weigh-ins yet'}</p></div>
      <div className="card"><dt>Routines</dt><dd>{detail.routines.length}</dd><p>In current plan</p></div>
      <div className="card"><dt>Weigh-ins</dt><dd>{detail.bodyweight.length}</dd><p>Progress entries</p></div>
    </dl>

    <div className="client-grid">
      <section className="card client-section" aria-labelledby="client-weight-title">
        <div className="client-section-header"><h2 id="client-weight-title">Body-weight progress</h2><span className="small muted">{detail.unit}</span></div>
        {weightChange !== null && <p className="small muted client-weight-change">{weightChange > 0 ? '+' : ''}{fmtNum(weightChange)} {detail.unit} since first weigh-in</p>}
        <LineChart points={weightPoints} unit={detail.unit} />
      </section>

      <section className="card client-section" aria-labelledby="client-plan-title">
        <div className="client-section-header"><h2 id="client-plan-title">Current plan</h2><span className="tag">{detail.routines.length} routines</span></div>
        {detail.routines.length ? <div className="client-list">{detail.routines.map(r => <details className="client-routine" key={r.id}>
          <summary><span className="grow"><span className="client-row-title">{r.name}</span><span className="small muted">{(r.ex || []).length} exercises</span></span></summary>
          <div className="client-routine-exercises">{(r.ex || []).map((entry, index) => <div className="client-row" key={entry.id + '-' + index}><span className="small capitalize">{exerciseName(entry.id)}</span><span className="small muted">{entry.sets ?? 3} sets</span></div>)}
            {!r.ex?.length && <p className="small muted">No exercises added yet.</p>}
          </div>
        </details>)}</div> : <div className="empty small">No routines yet.</div>}
      </section>

      <section className="card client-section" aria-labelledby="client-performance-title">
        <div className="client-section-header"><h2 id="client-performance-title">Exercise performance</h2></div>
        <p className="small muted">Best estimated one-rep max from completed sets.</p>
        {performance.length ? <div className="client-list">{performance.map(p => <div className="client-row" key={p.id}>
          <div className="grow"><div className="client-row-title capitalize">{exerciseName(p.id)}</div><div className="small muted">{fmtNum(p.weight)} {detail.unit} × {p.reps} · {fmtDate(p.date, true)}</div></div>
          <span className="tag acc">{fmtNum(p.estimate)} {detail.unit}</span>
        </div>)}</div> : <div className="empty small">No eligible completed sets yet.</div>}
      </section>

      <section className="card client-section" aria-labelledby="client-history-title">
        <div className="client-section-header"><h2 id="client-history-title">Workout history</h2><span className="tag">{workouts.length} total</span></div>
        {workouts.length ? <><div className="client-list">{workouts.slice(0, shown).map(w => <div key={w.id} className="client-row">
          <div className="grow"><div className="client-row-title">{w.name}</div><div className="small muted">{fmtDate(w.d, true)} · {fmtDur((w.end || w.start) - w.start)} · {setsDone(w)} sets{w.prs?.length ? ' · ' + w.prs.length + ' PR' : ''}</div></div>
          <span className="small muted">{fmtVol(w.vol ?? workoutVolume(w), detail.unit)}</span>
        </div>)}</div>{workouts.length > shown && <Button className="client-more" onClick={() => setShown(n => n + 10)}>Show more workouts</Button>}</> : <div className="empty small">No workouts logged.</div>}
      </section>
    </div>

    <details className="card client-account">
      <summary>Account settings</summary>
      {u.invitedBy && <p className="small muted">Invited by {u.invitedBy}</p>}
      {!u.admin && <div className="client-access">
        <p className="small muted">{u.disabled ? 'This account is disabled. Enable it to allow login again.' : 'Disable access temporarily, or permanently delete this client and their data.'}</p>
        {confirmDelete ? <div className="client-delete-confirm" role="alert">
          <h3>Delete {u.name}'s account?</h3>
          <p className="small muted">This permanently deletes their account, profile photo, training plan, workout history, and weigh-ins. This cannot be undone.</p>
          <div className="client-account-actions">
            <Button autoFocus disabled={pending} onClick={() => setConfirmDelete(false)}>Cancel deletion</Button>
            <Button variant="danger" disabled={pending} onClick={deleteAccount}>{pending ? 'Deleting…' : 'Permanently delete account'}</Button>
          </div>
        </div> : <div className="client-account-actions">
          <Button disabled={pending || loading} variant={u.disabled ? 'primary' : 'tinted'} onClick={() => u.disabled ? setDisabled(false)
            : confirmSheet({ title: 'Disable ' + u.name + '?', message: 'They will no longer be able to log in or sync. Their data stays saved, and you can enable the account again at any time.', confirmText: 'Disable account', danger: true, onConfirm: () => setDisabled(true) })}>{u.disabled ? 'Enable account' : 'Disable account'}</Button>
          <Button disabled={pending || loading} variant="danger" icon="trash" onClick={() => setConfirmDelete(true)}>Delete account</Button>
        </div>}
      </div>}
      <div className="client-account-actions">
        {!u.admin && <Button disabled={pending || loading} onClick={() => setRole('trainer')}>Promote to trainer</Button>}
        {u.admin && u.id !== viewer?.id && <Button disabled={pending || loading} variant="danger" onClick={() => setRole('client')}>Demote to client</Button>}
        {u.id === viewer?.id && <p className="small muted">You are viewing your own trainer account.</p>}
      </div>
    </details>
  </main>
}
