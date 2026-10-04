import { t } from '../lib/i18n.js'

export default function TrainingDays({ value, onChange }) {
  return <fieldset className="training-days">
    <legend>{t('How many days per week are you willing to train?')}</legend>
    <p className="small muted">{t('Choose the number of training days you can commit to each week.')}</p>
    <div className="training-days-options">
      {[2, 3, 4, 5, 6].map(days => <button type="button" key={days}
        aria-label={t('{0} days per week', days)} aria-pressed={value === days}
        onClick={() => onChange(days)}>{days}</button>)}
    </div>
    <p className="training-days-selection" aria-live="polite">
      {value ? t('{0} days per week', value) : t('Choose how many days you can train')}
    </p>
  </fieldset>
}
