import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { api } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import { profileComplete, profileStepError } from '../lib/profile.js'
import { applyOnboarding, buildOnboardingProgram, GOALS, EXPERIENCES, EQUIPMENT } from '../lib/onboarding.js'
import { Button, NumberField, Segmented, TextArea } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import ProfilePhoto from '../components/ProfilePhoto.jsx'

const titles = ['Your body and goals', 'Your training preferences', 'Review your profile']
function Choices({ options, value, onChange }) {
  return <div className="list setup-choices">{options.map(option => <button type="button" key={option.value} className="item" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
    <span className="grow">{t(option.label)}</span>{value === option.value && <Icon name="check" />}
  </button>)}</div>
}

export default function ProfileSetup() {
  const { step: stepParam } = useParams()
  const step = Number(stepParam) - 1
  const navigate = useNavigate()
  const st = useStore(s => s.S)
  const user = useStore(s => s.user)
  const key = 'gym_profile_draft_' + user.id
  const [profile, setProfile] = useState(() => {
    const previous = st.onboarding || {}
    let draft = {}
    try { draft = JSON.parse(sessionStorage.getItem(key)) || {} } catch { /* use saved profile */ }
    return {
      goal: previous.goal === 'gain_weight' ? 'muscle' : previous.goal || '',
      currentWeight: previous.currentWeight || st.bodyweight.at(-1)?.w || null,
      height: previous.height || null, targetWeight: previous.targetWeight || st.targetW || null,
      days: previous.days || null, experience: previous.experience || '', equipment: previous.equipment || '',
      profileImage: st.profileImage || null, body: previous.body || '', injuryNote: previous.injuryNote || '', ...draft,
    }
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const preservePlan = st.routines.length > 0
  const recommendation = useMemo(() => buildOnboardingProgram(profile), [profile])
  const set = values => {
    setError('')
    setProfile(current => {
      const next = { ...current, ...values }
      try { sessionStorage.setItem(key, JSON.stringify(next)) } catch { /* still usable without storage */ }
      return next
    })
  }
  useEffect(() => { document.getElementById('setup-title')?.focus() }, [step])

  if (!Number.isInteger(step) || step < 0 || step > 2) return <Navigate to="/setup/1" replace />
  for (let previous = 0; previous < step; previous++) {
    if (profileStepError(profile, previous)) return <Navigate to={'/setup/' + (previous + 1)} replace />
  }
  const next = () => {
    const message = profileStepError(profile, step)
    if (message) { setError(t(message)); return }
    navigate('/setup/' + (step + 2))
  }
  const save = async () => {
    const message = profileStepError(profile, 0) || profileStepError(profile, 1)
    if (message) { setError(t(message)); return }
    setSaving(true)
    setError('')
    try {
      const state = JSON.parse(JSON.stringify(useStore.getState().S))
      const { profileImage, ...fitnessProfile } = profile
      applyOnboarding(state, fitnessProfile, Date.now(), { preservePlan })
      state.profileImage = profileImage || null
      state._ts = Date.now()
      const result = await api('/api/data', { method: 'PUT', body: JSON.stringify({ state, revisions: useStore.getState().revisions }) })
      if (useStore.getState().user?.id !== user.id) return
      if (!profileComplete(result.state?.onboarding)) throw new Error(t('Your profile could not be saved. Please try again.'))
      useStore.getState().setRevisions(result.revisions)
      useStore.getState().replaceState(result.state, false)
      useStore.setState({ profileConfirmed: true, profileLoaded: true, profileLoadError: '' })
      try { sessionStorage.removeItem(key); localStorage.removeItem('gym_dirty') } catch { /* profile is already saved */ }
      navigate('/home', { replace: true })
    } catch (e) { setError(e.message || t('Your profile could not be saved. Please try again.')) }
    finally { setSaving(false) }
  }
  const signOut = async () => { await useStore.getState().signOut(); navigate('/home', { replace: true }) }
  const labelFor = (options, value) => t(options.find(option => option.value === value)?.label || value)

  return <main className="profile-setup">
    <header className="setup-header"><div><p className="small muted">{t('Complete your fitness profile')}</p><p className="small">{t('Step {0} of {1}', step + 1, 3)}</p></div><Button size="sm" disabled={saving} onClick={signOut}>{t('Sign out')}</Button></header>
    <ol className="setup-progress" aria-label={t('Profile setup progress')}>{titles.map((title, index) => <li key={title} className={index <= step ? 'on' : ''} aria-current={index === step ? 'step' : undefined}><span>{index + 1}</span>{t(['Details', 'Training', 'Review'][index])}</li>)}</ol>
    <h1 id="setup-title" tabIndex={-1}>{t(titles[step])}</h1>
    <p className="muted setup-intro">{t('Your account is active. Complete all three steps to unlock your workouts and dashboard.')}</p>
    <form onSubmit={event => { event.preventDefault(); if (!saving && !photoBusy) step < 2 ? next() : save() }}>
      <fieldset disabled={saving} className="setup-fields">
        {step === 0 && <section className="card">
          <ProfilePhoto value={profile.profileImage} name={user.name} onChange={profileImage => set({ profileImage })} onBusyChange={setPhotoBusy} disabled={saving} />
          <h2>{t('What is your main goal?')}</h2>
          <Choices options={GOALS} value={profile.goal} onChange={goal => set({ goal })} />
          <div className="setup-measurements">
            <label>{t('Current weight ({0})', st.unit)}<NumberField className="current-weight-input" aria-label={t('Current weight ({0})', st.unit)} value={profile.currentWeight} placeholder="0.0" onChange={currentWeight => set({ currentWeight })} /></label>
            <label>{t('Height (cm)')}<NumberField className="current-weight-input" aria-label={t('Height (cm)')} value={profile.height} placeholder="0" onChange={height => set({ height })} /></label>
          </div>
          {profile.goal === 'lose_weight' && <label className="setup-target">{t('Target weight ({0})', st.unit)}<NumberField className="current-weight-input" aria-label={t('Target weight ({0})', st.unit)} value={profile.targetWeight} placeholder="0.0" onChange={targetWeight => set({ targetWeight })} /></label>}
        </section>}
        {step === 1 && <section className="card">
          <h2>{t('How often can you train?')}</h2>
          <Segmented options={[2, 3, 4, 5, 6].map(value => ({ value, label: String(value) }))} value={profile.days} onChange={days => set({ days })} />
          <p className="small muted">{t('Days per week')}</p>
          <h2 className="setup-section-title">{t('Training experience')}</h2>
          <Choices options={EXPERIENCES} value={profile.experience} onChange={experience => set({ experience })} />
          <h2 className="setup-section-title">{t('Available equipment')}</h2>
          <Choices options={EQUIPMENT} value={profile.equipment} onChange={equipment => set({ equipment })} />
          <h2 className="setup-section-title">{t('Body diagram')}</h2>
          <Choices options={[{value:'male',label:'Male'},{value:'female',label:'Female'},{value:'none',label:'No preference'}]} value={profile.body} onChange={body => set({ body })} />
        </section>}
        {step === 2 && <>
          <section className="card"><h2>{t('Your profile')}</h2><dl className="setup-summary">
            {[[t('Goal'),labelFor(GOALS,profile.goal)],[t('Current weight ({0})',st.unit),profile.currentWeight],[t('Height (cm)'),profile.height],...(profile.goal === 'lose_weight' ? [[t('Target weight ({0})',st.unit),profile.targetWeight]] : []),[t('Days per week'),profile.days],[t('Training experience'),labelFor(EXPERIENCES,profile.experience)],[t('Available equipment'),labelFor(EQUIPMENT,profile.equipment)],[t('Body diagram'),t(profile.body === 'none' ? 'No preference' : profile.body === 'female' ? 'Female' : 'Male')]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl></section>
          <section className="card"><label className="setup-note">{t('Anything we should know?')}<span className="small muted">{t('Optional injury or limitation')}</span><TextArea rows="3" maxLength="300" value={profile.injuryNote} onChange={event => set({ injuryNote:event.target.value })} /></label></section>
          <section className="card"><h2>{t(preservePlan ? 'Your current plan' : 'Your starting plan')}</h2><p className="muted">{preservePlan ? t('Your existing routines and training schedule will stay in place.') : t('{0} · {1} days per week',t(recommendation.name),recommendation.days)}</p></section>
        </>}
      </fieldset>
      {error && <p className="setup-error" role="alert">{error}</p>}
      <div className="setup-actions">{step > 0 && <Button type="button" disabled={saving} onClick={() => navigate('/setup/' + step)}>{t('Back')}</Button>}<Button type="submit" variant="primary" disabled={saving || photoBusy}>{saving ? t('Saving…') : step < 2 ? t('Next') : t('Save profile and continue')}</Button></div>
    </form>
  </main>
}

export function ProfileLoading({ error }) {
  return <main className="profile-setup"><div className="card" role="status">
    <h1>{t(error ? 'Unable to load your profile' : 'Loading your profile…')}</h1>
    {error && <><p className="muted setup-intro">{t(error)}</p>
      <Button onClick={() => useStore.getState().pullState()}>{t('Try again')}</Button>
      <Button onClick={() => useStore.getState().signOut()}>{t('Sign out')}</Button>
    </>}
  </div></main>
}
