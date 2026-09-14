import { t } from '../lib/i18n.js'

export default function TrainingConstraints({ profile, onChange }) {
  return <div className="training-constraints">
    <label>{t('Time per session')}
      <select value={profile.sessionMinutes || 60} onChange={event => onChange({ sessionMinutes: Number(event.target.value) })}>
        {[30, 45, 60, 75, 90].map(minutes => <option key={minutes} value={minutes}>{t('{0} minutes', minutes)}</option>)}
      </select>
    </label>
    <label>{t('Current recovery')}
      <select value={profile.recovery || 'normal'} onChange={event => onChange({ recovery: event.target.value })}>
        <option value="normal">{t('Recovering well between sessions')}</option>
        <option value="limited">{t('Returning after a break / limited recovery')}</option>
      </select>
    </label>
    <p className="small muted">{t('Returning or struggling to recover lowers the starting workload. Session estimates include warm-up and rest; actual time will vary.')}</p>
    {profile.equipment === 'dumbbells' && <label className="training-equipment-check">
      <input type="checkbox" checked={profile.hasBench === true} onChange={event => onChange({ hasBench: event.target.checked })} />
      <span>{t('I also have a stable exercise bench')}</span>
    </label>}
    {profile.equipment === 'bodyweight' && <label className="training-equipment-check">
      <input type="checkbox" checked={profile.hasPullStation === true} onChange={event => onChange({ hasPullStation: event.target.checked })} />
      <span>{t('I have secure stations for both bodyweight rows and pull-ups')}</span>
    </label>}
  </div>
}
