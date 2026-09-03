import { bmiBand, bmiPosition } from '../lib/bmi.js'
import { fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

const BAND_LABELS = {
  underweight: 'Underweight', healthy: 'Healthy range', overweight: 'Overweight', obesity: 'Obesity',
}

export default function BmiCard({ value, weight, unit, height, onAddHeight }) {
  if (value == null) return (
    <button className="card bmi-card bmi-empty" onClick={onAddHeight}>
      <span className="bmi-icon"><Icon name="figureStrength" /></span>
      <span className="grow">
        <span className="bmi-title">{t('Body mass index')}</span>
        <span className="small muted">{t('Add your height in Fitness profile to calculate BMI.')}</span>
      </span>
      <Icon name="chevronRight" className="chev" />
    </button>
  )

  const band = bmiBand(value)
  const label = t(BAND_LABELS[band])
  const position = bmiPosition(value)

  return <section className="card bmi-card" data-band={band}>
    <div className="bmi-head">
      <div>
        <div className="bmi-title">{t('Body mass index')}</div>
        <div className="bmi-reading"><strong>{fmtNum(value)}</strong><span>BMI</span></div>
      </div>
      <span className="bmi-status">{label}</span>
    </div>

    <div className="bmi-graph" role="img" aria-label={`${t('BMI')} ${fmtNum(value)} — ${label}`}>
      <div className="bmi-scale">
        <i className="underweight" /><i className="healthy" /><i className="overweight" /><i className="obesity" />
        <span className="bmi-marker" style={{ left: `${position}%` }}><b>{fmtNum(value)}</b></span>
      </div>
      <div className="bmi-ticks"><span>18.5</span><span>25</span><span>30</span></div>
      <div className="bmi-legend">
        <span>{t('Underweight')}</span><span>{t('Healthy range')}</span><span>{t('Overweight')}</span><span>{t('Obesity')}</span>
      </div>
    </div>

    <div className="small muted bmi-basis">{t('Based on {0} {1} and {2} cm', fmtNum(weight), unit, fmtNum(height))}</div>
    <div className="small dim bmi-note">{t('BMI is a screening measure for adults, not a diagnosis.')}</div>
  </section>
}
