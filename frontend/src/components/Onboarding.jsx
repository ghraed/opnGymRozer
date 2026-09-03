import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { bmiFor } from '../lib/bmi.js'
import { EXIDX } from '../lib/exercises.js'
import { programById } from '../lib/starter.js'
import { buildOnboardingProgram, applyOnboarding, selectablePrograms, programForDays, EQUIPMENT, EXPERIENCES, GOALS } from '../lib/onboarding.js'
import Icon from './Icon.jsx'
import { Button, NumberField, Segmented, TextArea } from './ui.jsx'

const targetGoal = goal => goal === 'lose_weight'

function ChoiceList({ options, value, onChange }) {
  return <div className="list">{options.map(option => <button key={option.value} className="item" onClick={() => onChange(option.value)}>
    <span className="grow"><span className="tt">{t(option.label)}</span></span>
    {value === option.value && <Icon name="check" className="accent" />}
  </button>)}</div>
}

export default function Onboarding({ close, allowSkip = true }) {
  const st = useStore(s => s.S)
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const [step, setStep] = useState(0)
  const previous = st.onboarding || {}
  const latestWeight = st.bodyweight[st.bodyweight.length - 1]?.w || null
  const initialDays = previous.days || 3
  const initialProgramId = selectablePrograms().includes(previous.programId) ? previous.programId : programForDays(initialDays)
  const [profile, setProfile] = useState({
    goal: previous.goal === 'gain_weight' ? 'muscle' : previous.goal || 'muscle', currentWeight: previous.currentWeight || latestWeight || null,
    height: previous.height || null,
    targetWeight: previous.targetWeight || st.targetW || null, days: initialDays, programId: initialProgramId,
    experience: previous.experience || 'beginner', equipment: previous.equipment || 'full_gym',
    body: previous.body || st.body || 'male', injuryNote: previous.injuryNote || '',
  })
  const [confirmReplace, setConfirmReplace] = useState(false)
  const plan = useMemo(() => buildOnboardingProgram(profile), [profile])
  const profileBmi = bmiFor(profile.currentWeight, profile.height, st.unit)
  const hasExistingSchedule = Object.values(st.week || {}).some(Boolean)
  const set = values => setProfile(current => ({ ...current, ...values }))

  const next = () => {
    if (step === 0 && !(Number(profile.currentWeight) > 0)) {
      toast(t('Enter a valid weight'))
      return
    }
    if (step === 0 && !(Number(profile.height) > 0)) {
      toast(t('Enter a valid height'))
      return
    }
    if (step === 0 && profile.goal === 'lose_weight' && (!(Number(profile.targetWeight) > 0) || Number(profile.targetWeight) >= Number(profile.currentWeight))) {
      toast(t('Enter a target weight below your current weight'))
      return
    }
    setStep(value => Math.min(2, value + 1))
  }
  const apply = () => {
    update(s => { applyOnboarding(s, profile) })
    close()
    toast(t('Your personalized plan is ready'))
  }
  const skip = () => { close(); toast(t('Finish setup any time from Home or Settings')) }

  return <>
    <div className="row between" style={{ marginBottom: 6 }}>
      <h3 style={{ margin: 0 }}>{t('Set up your fitness profile')}</h3>
      <span className="small muted">{step + 1} / 3</span>
    </div>
    {step === 0 && <>
      <p className="muted small">{t('A few answers let us build a starting plan that fits you. You can change everything later.')}</p>
      <h4 className="sec">{t('What is your main goal?')}</h4>
      <ChoiceList options={GOALS} value={profile.goal} onChange={goal => set({ goal })} />
      <div style={{ height: 12 }} />
      <label className="small" style={{ display: 'grid', gap: 6 }}>{t('Current weight ({0})', st.unit)}
        <NumberField className="current-weight-input" value={profile.currentWeight} placeholder="0.0"
          aria-label={t('Current weight ({0})', st.unit)} onChange={currentWeight => set({ currentWeight })} />
      </label>
      <label className="small" style={{ display: 'grid', gap: 6, marginTop: 12 }}>{t('Height (cm)')}
        <NumberField className="current-weight-input" value={profile.height} placeholder="0"
          aria-label={t('Height (cm)')} onChange={height => set({ height })} />
      </label>
      {targetGoal(profile.goal) && <label className="small" style={{ display: 'grid', gap: 6, marginTop: 12 }}>{t('Target weight ({0})', st.unit)}
        <NumberField className="current-weight-input" value={profile.targetWeight} placeholder="0.0"
          aria-label={t('Target weight ({0})', st.unit)} onChange={targetWeight => set({ targetWeight })} />
      </label>}
    </>}
    {step === 1 && <>
      <h4 className="sec">{t('How often can you train?')}</h4>
      <Segmented options={[2, 3, 4, 5, 6].map(value => ({ value, label: String(value) }))} value={profile.days} onChange={days => set({ days })} />
      <p className="small muted">{t('{0} days per week', profile.days)}</p>
      <h4 className="sec">{t('Training experience')}</h4>
      <ChoiceList options={EXPERIENCES} value={profile.experience} onChange={experience => set({ experience })} />
      <h4 className="sec">{t('Available equipment')}</h4>
      <ChoiceList options={EQUIPMENT} value={profile.equipment} onChange={equipment => set({ equipment })} />
      <h4 className="sec">{t('Body diagram')}</h4>
      <Segmented options={[{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }, { value: 'none', label: t('Skip') }]} value={profile.body} onChange={body => set({ body })} />
    </>}
    {step === 2 && <>
      <h4 className="sec">{t('Anything we should know?')}</h4>
      <p className="muted small">{t('Optional: note an injury or limitation. This app cannot provide medical advice; check with a qualified professional when needed.')}</p>
      <TextArea rows="3" maxLength="300" placeholder={t('Optional injury or limitation')} value={profile.injuryNote} onChange={event => set({ injuryNote: event.target.value })} />
      <h4 className="sec">{t('Your recommendation')}</h4>
      <div className="card recommendation-card" style={{ marginBottom: 12 }}>
        <div className="recommendation-kicker"><Icon name="sparkles" />{t('Evidence-informed starting point')}</div>
        <div className="recommendation-name">{t(plan.name)}</div>
        <div className="recommendation-summary">{t('{0} days per week', plan.days)} · {t('{0} exercises', plan.routines.reduce((sum, routine) => sum + routine.ex.length, 0))}</div>
        <div className="recommendation-section-label">{t('Training split')}</div>
        <div className="recommendation-splits">
          {[plan.recommendedProgramId, ...selectablePrograms().filter(programId => programId !== plan.recommendedProgramId)].map(programId => {
            const program = programById(programId)
            return <button type="button" key={programId} aria-pressed={plan.programId === programId}
              className={`recommendation-split${plan.programId === programId ? ' on' : ''}`} onClick={() => set({ programId })}>
              <span>{t(program.name)}</span>
              {plan.recommendedProgramId === programId && <small>{t('Recommended')}</small>}
            </button>
          })}
        </div>
        <div className="recommendation-facts">
          <div><span>{t('Goal')}</span><strong>{t(profile.goal === 'muscle' ? 'Build muscle' : profile.goal === 'strength' ? 'Build strength' : profile.goal === 'lose_weight' ? 'Lose weight' : 'General fitness')}</strong></div>
          <div><span>{t('Equipment')}</span><strong>{t(EQUIPMENT.find(option => option.value === profile.equipment)?.label || 'Full gym')}</strong></div>
          <div><span>{t('Experience')}</span><strong>{t(EXPERIENCES.find(option => option.value === profile.experience)?.label || 'Beginner')}</strong></div>
          <div><span>{t('Main lifts')}</span><strong>{plan.evidence.mainSets} × {plan.evidence.mainReps}</strong></div>
          <div><span>{t('Body weight')}</span><strong>{profile.currentWeight} {st.unit}{profileBmi ? ` · ${t('BMI')} ${profileBmi}` : ''}</strong></div>
          <div><span>{t('Planned cardio')}</span><strong>{plan.evidence.cardioMinutes} {t('min/week')}</strong></div>
        </div>
        <div className="recommendation-section-label">{t('Exercises selected for your goal')}</div>
        <div className="recommendation-exercises">
          {plan.routines.map(routine => {
            const exercises = routine.ex.filter(entry => entry.mode !== 'cardio')
            return <div className="recommendation-routine" key={routine.id}>
              <strong>{t(routine.name)}</strong>
              <span>{exercises.slice(0, 4).map(entry => {
                const name = EXIDX[entry.id]?.n
                const reps = entry.repsMin > 0 && entry.repsMin < entry.reps ? `${entry.repsMin}–${entry.reps}` : entry.reps
                return name ? `${name} — ${entry.sets}×${reps}` : null
              }).filter(Boolean).join(' · ')}</span>
              {exercises.length > 4 && <small>{t('+{0} more', exercises.length - 4)}</small>}
            </div>
          })}
        </div>
        {profile.goal === 'lose_weight' && profile.targetWeight > 0 && <div className="recommendation-target">
          <Icon name="target" />{t('Weight target: {0} → {1} {2}', profile.currentWeight, profile.targetWeight, st.unit)}
        </div>}
        <div className="recommendation-guidance">
          {t('Use a weight that makes the final repetitions challenging; reaching complete failure is not required.')}
        </div>
        {plan.evidence.additionalCardioMinutes > 0 && <div className="recommendation-guidance">
          {t('For general health, add {0} minutes of moderate aerobic activity across the week.', plan.evidence.additionalCardioMinutes)}
        </div>}
        {plan.evidence.needsProfessionalReview && <div className="recommendation-warning">
          <Icon name="info" />{t('Your limitation note needs review by a qualified professional before using this plan.')}
        </div>}
        <div className="small muted recommendation-note">{t('This is an evidence-informed starting point, not a guarantee. Progress gradually and adjust for recovery and pain.')}</div>
      </div>
      {hasExistingSchedule && confirmReplace && <div className="card" style={{ borderColor: 'var(--orange)', marginBottom: 12 }}>
        <div className="small">{t('Your past workouts and existing routines will stay saved. The new plan will replace only your weekly schedule.')}</div>
        <div style={{ height: 10 }} /><Button variant="danger" onClick={apply}>{t('Confirm and apply plan')}</Button>
      </div>}
    </>}
    <div style={{ height: 16 }} />
    <div className="row onboarding-actions" style={{ gap: 8 }}>
      {step > 0 && <Button className="onboarding-back" onClick={() => setStep(value => value - 1)}>{t('Back')}</Button>}
      {step < 2 ? <Button variant="primary" onClick={next} style={{ flex: 1 }}>{t('Next')}</Button>
        : !confirmReplace && <Button variant="primary" onClick={hasExistingSchedule ? () => setConfirmReplace(true) : apply} style={{ flex: 1 }}>{t('Apply my plan')}</Button>}
    </div>
    {allowSkip && step < 2 && <><div style={{ height: 8 }} /><Button variant="ghost" className="onboarding-skip" onClick={skip}>{t('Skip for now')}</Button></>}
  </>
}
