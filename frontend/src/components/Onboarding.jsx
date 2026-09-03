import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { buildOnboardingProgram, applyOnboarding, EQUIPMENT, EXPERIENCES, GOALS } from '../lib/onboarding.js'
import Icon from './Icon.jsx'
import { Button, NumberField, Segmented, TextArea } from './ui.jsx'

const targetGoal = goal => goal === 'lose_weight' || goal === 'gain_weight'

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
  const [profile, setProfile] = useState({
    goal: previous.goal || 'muscle', currentWeight: previous.currentWeight || latestWeight || null,
    targetWeight: previous.targetWeight || st.targetW || null, days: previous.days || 3,
    experience: previous.experience || 'beginner', equipment: previous.equipment || 'full_gym',
    body: previous.body || st.body || 'male', injuryNote: previous.injuryNote || '',
  })
  const [confirmReplace, setConfirmReplace] = useState(false)
  const plan = useMemo(() => buildOnboardingProgram(profile), [profile])
  const set = values => setProfile(current => ({ ...current, ...values }))

  const next = () => {
    if (step === 0 && !(Number(profile.currentWeight) > 0)) {
      toast(t('Enter a valid weight'))
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
        <NumberField value={profile.currentWeight} onChange={currentWeight => set({ currentWeight })} />
      </label>
      {targetGoal(profile.goal) && <label className="small" style={{ display: 'grid', gap: 6, marginTop: 12 }}>{t('Target weight ({0})', st.unit)}
        <NumberField value={profile.targetWeight} onChange={targetWeight => set({ targetWeight })} />
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
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 10 }}><span className="lrow-i"><Icon name="sparkles" /></span><div><div className="tt">{t(plan.name)}</div><div className="ss">{t('{0} days per week', plan.days)} · {plan.routines.reduce((sum, routine) => sum + routine.ex.length, 0)} {t('exercises')}</div></div></div>
        <div className="small muted" style={{ marginTop: 10 }}>{t('This is a starting plan. You can edit exercises, sets and days at any time.')}</div>
      </div>
      {st.routines.length > 0 && !confirmReplace && <Button variant="danger" onClick={() => setConfirmReplace(true)}>{t('Replace active schedule')}</Button>}
      {st.routines.length > 0 && confirmReplace && <div className="card" style={{ borderColor: 'var(--orange)', marginBottom: 12 }}><div className="small">{t('Your past workouts and existing routines will stay saved. The new plan will replace only your weekly schedule.')}</div><div style={{ height: 10 }} /><Button variant="danger" onClick={apply}>{t('Confirm and apply plan')}</Button></div>}
    </>}
    <div style={{ height: 16 }} />
    <div className="row" style={{ gap: 8 }}>
      {step > 0 && <Button onClick={() => setStep(value => value - 1)}>{t('Back')}</Button>}
      {step < 2 ? <Button variant="primary" onClick={next} style={{ flex: 1 }}>{t('Next')}</Button>
        : !st.routines.length ? <Button variant="primary" onClick={apply} style={{ flex: 1 }}>{t('Apply my plan')}</Button> : null}
    </div>
    {allowSkip && step < 2 && <><div style={{ height: 8 }} /><Button variant="ghost" className="dim" onClick={skip}>{t('Skip for now')}</Button></>}
  </>
}
