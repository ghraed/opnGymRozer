import { physiqueFocusFor } from '../lib/physique-focus.js'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { api } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import { profileComplete, profileStepError, trainingStepError } from '../lib/profile.js'
import { applyOnboarding, buildOnboardingProgram, GOALS, EXPERIENCES, EQUIPMENT } from '../lib/onboarding.js'
import { Button, NumberField, TextArea } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import ProfilePhoto, { ProfileAvatar } from '../components/ProfilePhoto.jsx'
import TrainingDays from '../components/TrainingDays.jsx'
import ProgramRecommendation from '../components/ProgramRecommendation.jsx'
import TrainingConstraints from '../components/TrainingConstraints.jsx'
import StrengthLiftChoices from '../components/StrengthLiftChoices.jsx'
import { EXIDX } from '../lib/exercises.js'
import { EXTRA_EXERCISES, strengthLiftsFor, STRENGTH_PATTERNS } from '../lib/training-movements.js'
import { SEX_OPTIONS } from '../lib/training-evidence.js'

const titles = ['Your body and goals', 'Your training preferences', 'Review your profile']
const intros = [
  'Tell us where you are now and what you want to achieve. We’ll use these details to shape your starting plan.',
  'Build a routine around your schedule, experience, and the equipment you have.',
  'Check your details and explore your recommended plan. You can edit your answers before saving.',
]
const choiceDetails = {
  muscle: ['dumbbell', 'Develop muscle and improve your physique.'],
  strength: ['barbell', 'Focus on strength in your main lifts.'],
  lose_weight: ['scale', 'Work toward your target weight.'],
  fitness: ['figureRun', 'Build a consistent, balanced routine.'],
  beginner: ['bolt', 'New to training or building a foundation.'],
  intermediate: ['chart', 'Training regularly with a solid foundation.'],
  advanced: ['trophy', 'Experienced with structured training.'],
  full_gym: ['machine', 'Machines, cables, and free weights.'],
  dumbbells: ['dumbbell', 'Train with the dumbbells you have.'],
  bodyweight: ['figureStrength', 'Use your body weight for resistance.'],
}
function Choices({ options, value, onChange, label }) {
  return <div className="setup-choices" role="group" aria-label={t(label)}>{options.map(option => <button type="button" key={option.value} className="setup-choice" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
    {choiceDetails[option.value] && <span className="setup-choice-icon"><Icon name={choiceDetails[option.value][0]} /></span>}
    <span className="setup-choice-copy"><strong>{t(option.label)}</strong>{choiceDetails[option.value] && <small>{t(choiceDetails[option.value][1])}</small>}</span>
    <span className="setup-choice-check" aria-hidden="true">{value === option.value && <Icon name="check" />}</span>
  </button>)}</div>
}

function SetupCard({ title, icon, description, onEdit, children, className = '' }) {
  return <section className={'card setup-card ' + className}>
    <header className="setup-card-heading"><span className="setup-card-icon"><Icon name={icon} /></span><div><h2>{t(title)}</h2>{description && <p>{t(description)}</p>}</div>
      {onEdit && <Button type="button" size="sm" icon="pencil" onClick={onEdit}>{t('Edit')}</Button>}
    </header>{children}
  </section>
}

function Summary({ rows }) {
  return <dl className="setup-summary">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
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
      sex: previous.sex || null, programId: null,
      sessionMinutes: previous.sessionMinutes || null, recovery: previous.recovery || '',
      hasBench: previous.hasBench === true, hasPullStation: previous.hasPullStation === true,
      strengthLifts: previous.strengthLifts,
      profileImage: st.profileImage || null, body: previous.body || 'none', injuryNote: previous.injuryNote || '', ...draft,
    }
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const hasExistingPlan = st.routines.length > 0
  const [replacePlan, setReplacePlan] = useState(false)
  const preservePlan = hasExistingPlan && !replacePlan
  const recommendation = useMemo(() => buildOnboardingProgram({ ...profile, unit: st.unit }), [profile, st.unit])
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
    if ((previous === 1 ? trainingStepError(profile) : profileStepError(profile, previous))) return <Navigate to={'/setup/' + (previous + 1)} replace />
  }
  const next = () => {
    const message = step === 1 ? trainingStepError(profile) : profileStepError(profile, step)
    if (message) { setError(t(message)); return }
    navigate('/setup/' + (step + 2))
  }
  const save = async () => {
    const message = profileStepError(profile, 0) || trainingStepError(profile) || profileStepError(profile, 2)
    if (message) { setError(t(message)); return }
    if (!preservePlan && recommendation.status === 'NO_FEASIBLE_PLAN') { setError(t('Choose a feasible program or adjust your training constraints.')); return }
    setSaving(true)
    setError('')
    try {
      const state = JSON.parse(JSON.stringify(useStore.getState().S))
      const { profileImage, ...fitnessProfile } = profile
      applyOnboarding(state, { ...fitnessProfile, unit: st.unit }, Date.now(), { preservePlan })
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

  const detailRows = [
    [t('Goal'), labelFor(GOALS, profile.goal)],
    [t('Current weight ({0})', st.unit), profile.currentWeight],
    [t('Height (cm)'), profile.height],
    ...(profile.goal === 'lose_weight' ? [[t('Target weight ({0})', st.unit), profile.targetWeight]] : []),
  ]
  const trainingRows = [
    [t('Days per week'), t('{0} days per week', profile.days)],
    [t('Time per session'), t('{0} minutes', profile.sessionMinutes)],
    [t('Current recovery'), t(profile.recovery === 'limited' ? 'Limited / returning' : 'Recovering well')],
    [t('Training experience'), labelFor(EXPERIENCES, profile.experience)],
    [t('Available equipment'), labelFor(EQUIPMENT, profile.equipment)],
    [t('Sex'), profile.sex ? labelFor(SEX_OPTIONS, profile.sex) : t('Not provided')],
  ]

  return <main className="profile-setup auth-gold">
    <header className="setup-header">
      <div className="setup-brand"><img src="/brand/rozer-logo.png" alt="ROZER" width="1254" height="1254" /><span>{t('Complete your fitness profile')}</span></div>
      <Button type="button" size="sm" icon="signOut" disabled={saving} onClick={signOut}>{t('Sign out')}</Button>
    </header>
    <div className="setup-layout">
      <aside className="setup-sidebar">
        <div className="setup-active"><Icon name="checkCircle" />{t('Account activated')}</div>
        <h2>{t('Your next chapter starts here.')}</h2>
        <p className="setup-sidebar-intro">{t('Three steps to a plan that fits your life.')}</p>
        <ol className="setup-progress" aria-label={t('Profile setup progress')}>{titles.map((title, index) => <li key={title} className={index < step ? 'complete' : index === step ? 'current' : ''} aria-current={index === step ? 'step' : undefined}>
          <button type="button" disabled={index >= step || saving} onClick={() => navigate('/setup/' + (index + 1))}>
            <span className="setup-step-number">{index < step ? <Icon name="check" /> : index + 1}</span>
            <span className="setup-step-copy"><strong>{t(['Details', 'Training', 'Review'][index])}</strong><small>{t(title)}</small></span>
          </button>
        </li>)}</ol>
        <div className="setup-sidebar-note"><Icon name="clipboard" /><p>{t('Your answers shape your starting plan. You can update your profile later in Settings.')}</p></div>
      </aside>
      <div className="setup-content">
        <header className="setup-page-heading">
          <p className="setup-eyebrow">{t('Step {0} of {1}', step + 1, 3)}</p>
          <h1 id="setup-title" tabIndex={-1}>{t(titles[step])}</h1>
          <p className="setup-intro">{t(intros[step])}</p>
        </header>
        <form onSubmit={event => { event.preventDefault(); if (!saving && !photoBusy) step < 2 ? next() : save() }}>
          <fieldset disabled={saving} className="setup-fields">
            {step === 0 && <>
              <section className="card setup-photo-card" aria-label={t('Profile photo')}>
                <ProfilePhoto value={profile.profileImage} name={user.name} onChange={profileImage => set({ profileImage })} onBusyChange={setPhotoBusy} disabled={saving} />
                <p className="small muted">{t('Upload a profile photo here. You can change it later in Settings.')}</p>
              </section>
              <SetupCard title="What is your main goal?" icon="target" description="Choose the goal you want your plan to focus on.">
                <Choices label="What is your main goal?" options={GOALS} value={profile.goal} onChange={goal => set({ goal })} />
              </SetupCard>
              <SetupCard title="Your starting point" icon="scale" description="Add your current measurements to track your progress.">
                <div className="setup-measurements">
                  <label>{t('Current weight ({0})', st.unit)}<NumberField className="current-weight-input" aria-label={t('Current weight ({0})', st.unit)} value={profile.currentWeight} placeholder="0.0" onChange={currentWeight => set({ currentWeight })} /></label>
                  <label>{t('Height (cm)')}<NumberField className="current-weight-input" aria-label={t('Height (cm)')} value={profile.height} placeholder="0" onChange={height => set({ height })} /></label>
                </div>
                {profile.goal === 'lose_weight' && <label className="setup-target">{t('Target weight ({0})', st.unit)}<NumberField className="current-weight-input" aria-label={t('Target weight ({0})', st.unit)} value={profile.targetWeight} placeholder="0.0" onChange={targetWeight => set({ targetWeight })} /></label>}
              </SetupCard>
            </>}
            {step === 1 && <>
              <SetupCard title="Your weekly routine" icon="calendar">
                <TrainingDays value={profile.days} onChange={days => set({ days })} />
                <TrainingConstraints profile={profile} onChange={set} showEquipment={false} />
              </SetupCard>
              <SetupCard title="Training experience" icon="chart" description="Choose the level that best reflects your training today.">
                <Choices label="Training experience" options={EXPERIENCES} value={profile.experience} onChange={experience => set({ experience })} />
              </SetupCard>
              <SetupCard title="Available equipment" icon="dumbbell" description="We’ll choose exercises you can do with your equipment.">
                <Choices label="Available equipment" options={EQUIPMENT} value={profile.equipment} onChange={equipment => set({ equipment })} />
                {profile.equipment === 'dumbbells' && <label className="setup-equipment-check"><input type="checkbox" checked={profile.hasBench === true} onChange={event => set({ hasBench: event.target.checked })} /><span>{t('I also have a stable exercise bench')}</span></label>}
                {profile.equipment === 'bodyweight' && <label className="setup-equipment-check"><input type="checkbox" checked={profile.hasPullStation === true} onChange={event => set({ hasPullStation: event.target.checked })} /><span>{t('I have secure stations for both bodyweight rows and pull-ups')}</span></label>}
              </SetupCard>
              {profile.goal === 'strength' && <section className="card setup-card"><StrengthLiftChoices profile={profile} onChange={set} requireSelection /></section>}
              <SetupCard title="Sex" icon="person" description="Your selection sets the physique focus of your plan.">
                <Choices label="Sex" options={SEX_OPTIONS} value={profile.sex} onChange={sex => set({ sex, body: sex === 'unspecified' ? 'none' : sex })} />
                <div className="setup-focus" aria-live="polite"><Icon name="target" /><p><strong>{t(physiqueFocusFor(profile).label)}</strong><span>{t(physiqueFocusFor(profile).description)}</span></p></div>
              </SetupCard>
            </>}
            {step === 2 && <>
              <SetupCard title="Your profile" icon="person" onEdit={() => navigate('/setup/1')}>
                <div className="setup-review-photo"><ProfileAvatar value={profile.profileImage} name={user.name} viewable /><div><strong>{user.name}</strong><span>{t(profile.profileImage ? 'Profile photo' : 'No profile photo added (optional)')}</span></div></div>
                <Summary rows={detailRows} />
              </SetupCard>
              <SetupCard title="Your training preferences" icon="dumbbell" onEdit={() => navigate('/setup/2')}>
                <Summary rows={trainingRows} />
                {profile.goal === 'strength' && <><h3 className="setup-section-title">{t('Lifts you want to improve')}</h3>
                  <Summary rows={Object.entries(STRENGTH_PATTERNS).map(([pattern, spec]) => {
                    const id = strengthLiftsFor(profile)[pattern]
                    return [t(spec.label), t(EXIDX[id]?.n || EXTRA_EXERCISES.find(exercise => exercise.id === id)?.n || 'Unavailable')]
                  })} />
                </>}
              </SetupCard>
              <SetupCard title="Anything we should know?" icon="clipboard" description="Optional injury or limitation">
                <label className="setup-note"><span className="sr-only">{t('Anything we should know?')}</span><TextArea rows="3" maxLength="300" placeholder={t('Share any injuries or limitations with your trainer.')} value={profile.injuryNote} onChange={event => set({ injuryNote: event.target.value })} /><span className="setup-note-count" dir="ltr">{profile.injuryNote.length} / 300</span></label>
              </SetupCard>
              {hasExistingPlan && <SetupCard title="Your current plan" icon="calendar" description="You already have a plan. Keep its schedule, or use the program selected below. Previous routines and workout history stay saved.">
                <Choices label="Your current plan" options={[{ value: 'keep', label: 'Keep my current schedule' }, { value: 'replace', label: 'Use the selected program below' }]} value={replacePlan ? 'replace' : 'keep'} onChange={choice => setReplacePlan(choice === 'replace')} />
                {preservePlan && <p className="small muted setup-preserve-note">{t('The program below is a preview. Your current schedule will be kept when you save.')}</p>}
              </SetupCard>}
              <ProgramRecommendation profile={profile} plan={recommendation} unit={st.unit} onChoose={programId => set({ programId })} />
            </>}
          </fieldset>
          <footer className="setup-form-footer">
            {error && <p className="setup-error" role="alert"><Icon name="info" />{error}</p>}
            {step === 1 && trainingStepError(profile) && <p className="setup-validation" aria-live="polite"><Icon name="info" />{t(trainingStepError(profile))}</p>}
            <div className="setup-actions">
              {step > 0 && <Button type="button" icon="chevronLeft" disabled={saving} onClick={() => navigate('/setup/' + step)}>{t('Previous step')}</Button>}
              <Button type="submit" variant="primary" trailingIcon={step < 2 ? 'chevronRight' : 'check'} disabled={saving || photoBusy || (step === 1 && !!trainingStepError(profile)) || (step === 2 && !preservePlan && recommendation.status === 'NO_FEASIBLE_PLAN')}>{saving ? t('Saving…') : step === 0 ? t('Continue to training') : step === 1 ? t('Review my profile') : t('Save profile and continue')}</Button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  </main>
}

export function ProfileLoading({ error }) {
  return <main className="profile-setup setup-loading auth-gold"><div className="card" role="status">
    <img src="/brand/rozer-logo.png" alt="ROZER" width="1254" height="1254" />
    <div className="setup-loading-icon"><Icon name={error ? 'info' : 'person'} /></div>
    <h1>{t(error ? 'Unable to load your profile' : 'Loading your profile…')}</h1>
    {!error && <p className="setup-intro">{t('Getting your fitness profile ready.')}</p>}
    {error && <><p className="muted setup-intro">{t(error)}</p>
      <div className="setup-loading-actions"><Button variant="primary" onClick={() => useStore.getState().pullState()}>{t('Try again')}</Button>
      <Button onClick={() => useStore.getState().signOut()}>{t('Sign out')}</Button></div>
    </>}
  </div></main>
}
