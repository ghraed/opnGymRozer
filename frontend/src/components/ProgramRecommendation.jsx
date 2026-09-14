import { t } from '../lib/i18n.js'
import { EXIDX } from '../lib/exercises.js'
import { programById } from '../lib/starter.js'
import { selectablePrograms } from '../lib/onboarding.js'
import { GOAL_GUIDANCE, SEX_OPTIONS, TRAINING_SOURCES } from '../lib/training-evidence.js'
import { MUSCLES } from '../lib/training-volume.js'
import { Button } from './ui.jsx'

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const descriptions = {
  full_body: 'Train the whole body in each lifting session.',
  upper_lower: 'Alternate upper-body and lower-body sessions.',
  ppl: 'Separate pushing, pulling, and leg sessions.',
  bro_split: 'Focus on one main body part in each session.',
}

export default function ProgramRecommendation({ profile, plan, unit = 'kg', onChoose }) {
  const recommended = programById(plan.recommendedProgramId)
  const automatic = !profile.programId
  const source = id => TRAINING_SOURCES.find(item => item.id === id)
  const link = (id, label) => <a href={source(id).url} target="_blank" rel="noreferrer">{t(label || source(id).title)}</a>
  const exerciseFor = id => plan.customEx?.find(ex => ex.id === id) || EXIDX[id]
  return <section className="card recommendation-card setup-program" aria-labelledby="program-title">
    <h2 id="program-title">{t('Choose your program')}</h2>
    <p className="small muted">{t('Recommended for you: {0}', t(recommended.name))}</p>
    <div className="recommendation-splits" role="group" aria-label={t('Training split')}>
      {[plan.recommendedProgramId, ...selectablePrograms().filter(id => id !== plan.recommendedProgramId)].map(id => <button
        type="button" key={id} aria-pressed={plan.programId === id}
        className={'recommendation-split' + (plan.programId === id ? ' on' : '')} onClick={() => onChoose(id)}>
        <span>{t(programById(id).name)}</span>
        <small>{id === plan.recommendedProgramId ? t('Recommended') : t('Alternative')}</small>
        <span className="setup-split-description">{t(descriptions[id])}</span>
      </button>)}
    </div>
    {!automatic && <Button type="button" size="sm" className="setup-auto-program" onClick={() => onChoose(null)}>{t('Use automatic recommendation')}</Button>}
    <p className="small muted">{automatic ? t('Your recommendation updates when you change your profile.') : t('Your choice is selected. The Recommended badge still shows the system suggestion.')}</p>

    <div className="setup-plan-overview" aria-live="polite" aria-atomic="true">
      <h3>{t(plan.name)}</h3>
      <p>{t('{0} lifting days · {1} aerobic days per week', plan.evidence.resistanceDays, plan.evidence.aerobicDays)}</p>
    </div>
    <details className="setup-evidence" open>
      <summary>{t('Why this recommendation fits')}</summary>
      <p>{t('We compare all four splits using your goal, available days, experience, equipment, session length, and recovery. The recommendation favours a schedule that covers more of your weekly muscle workload within those limits.')}</p>
      <p>{t('Beginners and returning lifters get a preference for fewer lifting days. Full-body sessions have recovery days between them; extra available days can include aerobic activity.')}</p>
      <p>{t(GOAL_GUIDANCE[profile.goal] || GOAL_GUIDANCE.fitness)} {link('acsm2026', 'Training guidance')}</p>
      <p>{t('This comparison is a planning estimate, not a tested formula for your optimal split. Research finds similar results for split and full-body routines when volume is matched.')} {link('split2024', 'Read the review')}</p>
      <p>{t('Profile considered: {0} {1}, {2} cm; sex: {3}.', profile.currentWeight, unit, profile.height,
        t(SEX_OPTIONS.find(option => option.value === profile.sex)?.label || 'Not provided'))} {t('Weight and height help your trainer check equipment fit and track progress. They do not measure lifting ability, so starting loads are chosen by comfortable technique and effort.')}</p>
      <p>{t('The same training principles apply across sexes. We do not infer sex from your body diagram or assign lighter weights because of sex.')} {link('sex2025', 'Sex and training research')}</p>
    </details>

    {plan.evidence.combinedSplit && <p className="recommendation-guidance">{t('This split normally has more sessions than your available days. We combine its sessions to keep every body-part day represented.')}</p>}
    {plan.evidence.lowFrequencySplit && <p className="recommendation-guidance">{t('This choice can train some muscles only once a week. Full body or upper/lower can provide more frequent practice; six-day push/pull/legs repeats each session twice.')}</p>}
    {plan.evidence.bodyweightEquipment && <p className="recommendation-guidance">{t(profile.hasPullStation
      ? 'Pulling exercises use the secure rowing and pull-up stations you selected. Choose a variation you can control.'
      : 'Without a secure pulling station, this plan cannot provide sufficient back and biceps work. Those gaps are shown below; ask your trainer about equipment or alternatives.')}</p>}
    {plan.evidence.dumbbellEquipment && <p className="recommendation-guidance">{t(profile.hasBench
      ? 'Bench exercises use the stable bench you selected. Dumbbell rows provide horizontal pulling when a pulldown is unavailable.'
      : 'Dumbbell presses use the floor, and exercises requiring a bench are excluded. Dumbbell rows provide horizontal pulling when a pulldown is unavailable.')}</p>}

    <details className="setup-evidence setup-volume" open>
      <summary>{t('Weekly muscle workload')}</summary>
      <p>{t('Every selected resistance exercise uses 3 working sets. Exercise selection adapts to your weekly workload and available time. Three sets is the configured default; the cited studies do not establish it as a universal minimum.')}</p>
      <p>{t('Sets are counted across your actual week, including repeated sessions. Direct work counts as 1 set; assistance in another movement counts as 0.5. These are estimates, not measurements of muscle growth.')} {link('volume2026', 'Volume research')}</p>
      <p>{t('Your starting budget is {0} weekly sets per muscle, with up to {1} for the trunk. It reflects your goal, experience, and recovery. These budgets are adjustable starting choices, not minimum requirements or guaranteed optimal doses.', plan.evidence.target, plan.evidence.targets.core)}</p>
      <div className="setup-volume-grid">
        {plan.evidence.weeklyVolume.map(muscle => <div className="setup-volume-item" key={muscle.muscle}>
          <div><strong>{t(muscle.label)}</strong><span>{t('{0} / {1} sets', muscle.total, muscle.target)}</span></div>
          <meter min="0" max={Math.max(muscle.target, muscle.total)} value={muscle.total} aria-label={t('{0}: {1} estimated sets; starting budget {2}', t(muscle.label), muscle.total, muscle.target)} />
          <p>{t('{0} direct + {1} indirect · {2} sessions', muscle.direct, muscle.indirect, muscle.sessions)}</p>
          {muscle.shortfall > 0 && <small>{t('{0} below starting budget', muscle.shortfall)}</small>}
        </div>)}
      </div>
      {plan.evidence.volumeShortfalls.length > 0 && <p className="recommendation-guidance">{t('Some starting budgets do not fit this split, equipment, or time limit. You can compare another split, allow more time, or ask your trainer to adjust the workload. Lower volumes can still be productive.')}</p>}
      {plan.evidence.missingMuscles.length > 0 && <p className="recommendation-warning">{t('No counted work for: {0}. This plan has gaps that need trainer review.', plan.evidence.missingMuscles.map(m => t(m)).join(', '))}</p>}
      {plan.evidence.unavailableSessions.length > 0 && <p className="recommendation-warning">{t('No suitable exercises for: {0}. Change your equipment or split before using these sessions.', plan.evidence.unavailableSessions.map(name => t(name)).join(', '))}</p>}
    </details>

    <h3>{t('Your week and exercises')}</h3>
    <p className="small muted">{t('Open a session to see exercises and why their sets were chosen. Estimated duration stays within your {0}-minute session limit, including warm-up and rest.', plan.evidence.sessionMinutes)}</p>
    <div className="setup-workouts">
      {plan.routines.map(routine => <details className="setup-workout" key={routine.id}>
        <summary><span>{t(routine.name)}<small>{[1, 2, 3, 4, 5, 6, 0].filter(day => plan.week[day] === routine.id).map(day => t(dayNames[day])).join(' · ')}</small></span><span className="small muted">{t('{0} exercises', routine.ex.length)}<small>{t('About {0} min', Math.ceil(routine.estimatedMinutes))}</small></span></summary>
        <ol>{routine.ex.map(entry => <li key={entry.id}>
          <div className="setup-exercise-title"><span className="capitalize">{exerciseFor(entry.id)?.n || entry.id}</span><strong>{entry.mode === 'cardio' ? t('{0} min', entry.min) : `${entry.sets} × ${entry.repsMin && entry.repsMin < entry.reps ? `${entry.repsMin}–` : ''}${entry.reps}`}</strong></div>
          <p className="small muted">{t(entry.movement)}{entry.rest ? ' · ' + t('{0} sec rest', entry.rest) : ''}</p>
          {entry.adaptation && <p className="small muted">{t(entry.adaptation)}</p>}
          {entry.mode !== 'cardio' && <details className="setup-exercise-reason">
            <summary>{t('Why these sets and reps?')}</summary>
            <p>{t('{0} sets × {1} sessions = {2} weekly sets of this exercise. Every selected resistance exercise keeps 3 working sets. Weekly workload, movement coverage, time, and recovery guide which exercises are included.', entry.sets, entry.weeklyOccurrences, entry.weeklySets)}</p>
            {entry.volumeReason.map(muscle => <p key={muscle.muscle}>{t('{0} across the week: {1} direct + {2} indirect = {3} sets; starting budget {4}.', t(MUSCLES[muscle.muscle]), muscle.direct, muscle.indirect, muscle.total, muscle.target)}</p>)}
            <p>{t(entry.heavy ? 'The lower repetition range prioritizes heavier strength practice on this compound movement.' : entry.compound ? 'This moderate repetition range provides controlled practice on a compound movement.' : 'This accessory uses moderate to higher repetitions to add targeted work. The exact range is a practical choice; several ranges can build muscle.')}</p>
            <p>{t('Use a controllable load or variation and stop with about {0}–{1} good repetitions still possible. No maximum-weight test is required.', entry.effort.minRir, entry.effort.maxRir)}</p>
            <p>{link('volume2026', 'Sets')} · {link('iusca2021', 'Exercise and repetition guidance')} · {link('rest2024', 'Rest guidance')}</p>
          </details>}
        </li>)}</ol>
      </details>)}
    </div>
    <p className="recommendation-guidance">{t('Choose a load you can control through the full movement. Finish with a few repetitions still possible; increase gradually when the target becomes comfortable. Shorter aerobic bouts are fine.')}</p>
    <p className="small muted">{t('{0} minutes of aerobic activity are scheduled. Build toward at least 150 moderate minutes per week as tolerated; activity outside the gym counts.', plan.evidence.cardioMinutes)} {link('niddk', 'Activity guidance')}</p>
    {plan.evidence.needsProfessionalReview && <p className="recommendation-warning" role="status">{t('Your injury or limitation note needs review by your trainer and, where appropriate, a clinician before using these exercises. The generated plan has not been adapted to diagnose or treat that condition.')}</p>}
    <details className="setup-evidence">
      <summary>{t('Research and medical sources')}</summary>
      <p>{t('These guidelines and peer-reviewed studies support the training principles. They do not medically approve this app or each generated plan. The evidence here concerns generally healthy adults.')}</p>
      <ul>{TRAINING_SOURCES.map(item => <li key={item.id}>{link(item.id)}<p>{t(item.finding)}</p></li>)}</ul>
    </details>
  </section>
}
