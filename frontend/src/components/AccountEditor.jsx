import { useState } from 'react'
import { api } from '../lib/api.js'
import { useStore } from '../store/useStore.js'
import ProfilePhoto from './ProfilePhoto.jsx'
import { Button } from './ui.jsx'

export default function AccountEditor({ detail, onSaved, onCancel }) {
  const user = detail?.user
  const self = useStore(s => s.user?.id) === user?.id
  const [draft, setDraft] = useState(() => ({ name: user?.name || '', email: user?.email || '', password: '',
    role: user?.role || 'client', activated: user?.activated ?? true }))
  const [profile, setProfile] = useState(() => detail?.onboarding ? { ...detail.onboarding } : { goal: 'muscle', currentWeight: '', height: '', days: 3, experience: 'beginner', equipment: 'full_gym', body: 'none', completedAt: Date.now() })
  const [photo, setPhoto] = useState(detail?.profileImage || null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [editProfile, setEditProfile] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const field = key => ({ value: draft[key], onChange: event => setDraft(d => ({ ...d, [key]: event.target.value })) })
  const save = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const body = { ...draft, ...(photo !== (detail?.profileImage || null) ? { profileImage: photo } : {}), ...(user ? { id: user.id } : {}) }
      if (user && !body.password) delete body.password
      if (editProfile) body.onboarding = profile
      const result = await api(user ? '/api/admin/user' : '/api/admin/users', { method: user ? 'PUT' : 'POST', body: JSON.stringify(body) })
      if (self) { useStore.getState().setUser(result.user); await useStore.getState().pullState() }
      onSaved()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <form className="card account-editor" onSubmit={save}>
    <h2>{user ? 'Edit user profile' : 'Create user'}</h2>
    <fieldset disabled={busy || photoBusy}>
      <ProfilePhoto value={photo} name={draft.name} onChange={setPhoto} onBusyChange={setPhotoBusy} disabled={busy} />
      <label>Name<input className="input" required maxLength={80} autoComplete="off" {...field('name')} /></label>
      <label>Email<input className="input" type="email" required maxLength={254} autoComplete="off" {...field('email')} /></label>
      <label>{user ? 'New password (leave blank to keep current)' : 'Password'}<input className="input" type="password" required={!user} minLength={8} maxLength={200} autoComplete="new-password" {...field('password')} /></label>
      <label>Role<select className="input" disabled={self} {...field('role')}><option value="client">Client</option><option value="trainer">Trainer</option><option value="admin">Admin</option></select></label>
      {draft.role === 'client' && user?.activated === false && <p className="small muted">Assign a membership plan through account approval to activate this member.</p>}
      {draft.role === 'client' && user?.activated !== false && <label className="row"><input type="checkbox" checked={draft.activated} onChange={e => setDraft(d => ({ ...d, activated: e.target.checked }))} />Account activated</label>}
      {profile && <><label className="row"><input type="checkbox" checked={editProfile} onChange={e => setEditProfile(e.target.checked)} />Edit fitness profile</label>
        {editProfile && <div className="account-profile-fields">
          {[['currentWeight', 'Weight (kg)'], ['height', 'Height (cm)'], ['targetWeight', 'Target weight (kg)']].map(([key, label]) => <label key={key}>{label}<input className="input" type="number" min="1" step="any" required={key !== 'targetWeight'} value={profile[key] ?? ''} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value === '' ? null : Number(e.target.value) }))} /></label>)}
          {Object.entries({ goal: ['muscle', 'strength', 'lose_weight', 'fitness'], experience: ['beginner', 'intermediate', 'advanced'], equipment: ['full_gym', 'dumbbells', 'bodyweight'], days: [2, 3, 4, 5, 6], body: ['male', 'female', 'none'] }).map(([key, values]) => <label key={key}>{key}<select className="input" value={profile[key]} onChange={e => setProfile(p => ({ ...p, [key]: key === 'days' ? Number(e.target.value) : e.target.value }))}>{values.map(value => <option key={value} value={value}>{String(value).replaceAll('_', ' ')}</option>)}</select></label>)}
          {Object.entries({ sex: ['male', 'female', 'unspecified'], programId: ['full_body', 'upper_lower', 'ppl', 'bro_split'], sessionMinutes: [30, 45, 60, 75, 90], recovery: ['normal', 'limited'] }).map(([key, values]) => <label key={key}>{key}<select className="input" value={profile[key] ?? ''} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value === '' ? null : key === 'sessionMinutes' ? Number(e.target.value) : e.target.value }))}><option value="">Not specified</option>{values.map(value => <option key={value} value={value}>{String(value).replaceAll('_', ' ')}</option>)}</select></label>)}
          {['hasBench', 'hasPullStation'].map(key => <label className="row" key={key}><input type="checkbox" checked={!!profile[key]} onChange={e => setProfile(p => ({ ...p, [key]: e.target.checked }))} />{key === 'hasBench' ? 'Has bench' : 'Has pulling station'}</label>)}
        </div>}
      </>}
      {error && <p role="alert" style={{ color: 'var(--red)' }}>{error}</p>}
      <div className="client-account-actions"><Button type="submit" variant="primary">{busy ? 'Saving…' : user ? 'Save changes' : 'Create user'}</Button><Button type="button" onClick={onCancel}>Cancel</Button></div>
    </fieldset>
  </form>
}
