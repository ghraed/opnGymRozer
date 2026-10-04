import { EXIDX } from '../lib/exercises.js'
import { EXTRA_EXERCISES, STRENGTH_PATTERNS, strengthLiftOptions, strengthLiftsFor } from '../lib/training-movements.js'
import { t } from '../lib/i18n.js'

const exerciseName = id => EXIDX[id]?.n || EXTRA_EXERCISES.find(exercise => exercise.id === id)?.n || id

export default function StrengthLiftChoices({ profile, onChange, requireSelection = false }) {
  if (profile.goal !== 'strength') return null
  const options = strengthLiftOptions(profile)
  const selected = requireSelection ? profile.strengthLifts || {} : strengthLiftsFor(profile)
  return <div className="training-constraints strength-lift-choices">
    <h2 className="setup-section-title">{t('Lifts you want to improve')}</h2>
    <p className="small muted">{t('Choose one exercise for each pattern. Your plan will put these lifts before accessory work and aim to practice each twice weekly.')}</p>
    {Object.entries(STRENGTH_PATTERNS).map(([pattern, spec]) => {
      const current = selected[pattern] || ''
      const valid = options[pattern].some(option => option.id === current)
      return <label key={pattern}>{t(spec.label)}
        <select required={requireSelection} value={current} disabled={!options[pattern].length}
          onChange={event => onChange({ strengthLifts: { ...selected, [pattern]: event.target.value } })}>
          {!valid && <option value={current} disabled>{t(options[pattern].length ? (current ? 'Previous choice unavailable — choose another' : 'Choose one exercise for each pattern.') : 'No available exercise for this pattern')}</option>}
          {options[pattern].map(option => <option key={option.id} value={option.id}>{t(exerciseName(option.id))}</option>)}
        </select>
      </label>
    })}
  </div>
}
