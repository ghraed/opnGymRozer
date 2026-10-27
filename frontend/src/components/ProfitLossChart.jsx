import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { accountingMoney as money } from '../lib/accounting.js'
import { profitSeries, profitScale } from '../lib/profit-loss.js'
import Icon from './Icon.jsx'

const monthLabel = month => new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(month + '-01T00:00:00Z'))
const periodLabel = point => point.month === point.lastMonth ? monthLabel(point.month) : `${monthLabel(point.month)} – ${monthLabel(point.lastMonth)}`
const compact = value => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: Math.abs(value) < 1 ? 2 : 1 }).format(value)

export default function ProfitLossChart({ months, from, to, currency }) {
  const { points, bucketMonths } = useMemo(() => profitSeries(months, from, to), [months, from, to])
  const [selected, setSelected] = useState(points.length - 1)
  const [width, setWidth] = useState(640)
  const wrap = useRef(null)
  const id = useId()
  useEffect(() => {
    const resize = () => setWidth(Math.max(240, wrap.current?.clientWidth || 640))
    resize()
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize) }
    const observer = new ResizeObserver(resize)
    observer.observe(wrap.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => { setSelected(Math.max(0, points.length - 1)) }, [points])
  const active = points[Math.max(0, Math.min(points.length - 1, selected))]
  const height = width < 480 ? 230 : 280, left = 48, right = width - 14, top = 18, bottom = height - 34
  const scale = profitScale(points)
  const y = value => top + (scale.max - Number(value)) / (scale.max - scale.min) * (bottom - top)
  const zero = y(0), slot = (right - left) / Math.max(1, points.length), bar = Math.min(28, slot * .26)
  const x = index => left + slot * (index + .5)
  const labelCount = Math.min(points.length, width < 480 ? 4 : 7)
  const labelIndices = new Set(Array.from({ length: labelCount }, (_, index) => Math.round(index * (points.length - 1) / Math.max(1, labelCount - 1))))
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${x(index)},${y(point.profit)}`).join(' ')
  const selectPointer = event => {
    const bounds = event.currentTarget.getBoundingClientRect()
    setSelected(Math.max(0, Math.min(points.length - 1, Math.floor(((event.clientX - bounds.left) * width / bounds.width - left) / slot))))
  }
  const onKey = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    setSelected(index => event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : Math.max(0, Math.min(points.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1))))
  }
  return <section className="card pnl-chart-card" aria-labelledby={id + '-heading'}>
    <div className="pnl-chart-header"><div><p className="finance-eyebrow">{currency} PERFORMANCE</p><h3 id={id + '-heading'}>{bucketMonths === 1 ? 'Monthly cash flow' : 'Cash flow over time'}</h3><p>{bucketMonths === 1 ? 'Revenue, expenses and net result by month.' : `Totals grouped into ${bucketMonths}-month periods.`}</p></div><span className="pnl-currency-pill">{currency}</span></div>
    <div className="pnl-chart-legend" aria-label="Chart legend"><span><i className="is-revenue" />Revenue</span><span><i className="is-expense" />Expenses</span><span><i className="is-net" />Net result</span></div>
    <div ref={wrap} className="pnl-chart-plot">{months.length && active ? <>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ aspectRatio: `${width}/${height}` }} tabIndex={0} role="img" aria-labelledby={`${id}-heading ${id}-description`} onPointerMove={selectPointer} onPointerDown={selectPointer} onKeyDown={onKey}>
        <desc id={id + '-description'}>Solid revenue bars, striped expense bars and a net result line in the selected theme color. Use left and right arrow keys to inspect periods. Exact values appear below.</desc>
        <defs><pattern id={id + '-expense-pattern'} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect className="pnl-expense-tint" width="6" height="6" /><path className="pnl-expense-stripe" d="M0 0V6" /></pattern></defs>
        {scale.ticks.map(tick => <g key={tick}><line className={tick === 0 ? 'pnl-zero-line' : 'pnl-grid-line'} x1={left} x2={right} y1={y(tick)} y2={y(tick)} /><text x={left - 8} y={y(tick) + 4} textAnchor="end">{compact(tick)}</text></g>)}
        <rect className="pnl-selected-column" x={left + selected * slot} y={top} width={slot} height={bottom - top} rx="6" />
        {points.map((point, index) => <g key={point.month}>
          <rect className="pnl-bar is-revenue" x={x(index) - bar - 2} y={y(point.revenue)} width={bar} height={Math.max(0, zero - y(point.revenue))} rx="3" style={{ transformOrigin: `${x(index)}px ${zero}px`, animationDelay: `${Math.min(index * 25, 250)}ms` }} />
          <rect className="pnl-bar is-expense" x={x(index) + 2} y={y(point.expenses)} width={bar} height={Math.max(0, zero - y(point.expenses))} rx="3" style={{ fill: `url(#${id}-expense-pattern)`, transformOrigin: `${x(index)}px ${zero}px`, animationDelay: `${Math.min(index * 25 + 50, 300)}ms` }} />
          {labelIndices.has(index) && <text x={x(index)} y={height - 10} textAnchor={points.length === 1 ? 'middle' : index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}>{monthLabel(point.month).replace(' ', ' ’').replace(/20(\d\d)$/, '$1')}</text>}
        </g>)}
        <path className="pnl-net-line" d={path} pathLength="1" />
        {points.map((point, index) => <circle key={point.month} className={'pnl-net-point' + (Number(point.profit) < 0 ? ' is-loss' : '')} cx={x(index)} cy={y(point.profit)} r={index === selected ? 5 : 3} />)}
      </svg>
      <div className="pnl-period-picker"><label htmlFor={id + '-period'}>Inspect period</label><select id={id + '-period'} className="input" value={selected} onChange={event => setSelected(Number(event.target.value))}>{points.map((point, index) => <option key={point.month} value={index}>{periodLabel(point)}</option>)}</select></div>
      <dl className="pnl-chart-values" aria-live="polite" aria-atomic="true"><div><dt>Revenue</dt><dd>{money(active.revenue, currency)}</dd></div><div><dt>Expenses</dt><dd>{money(active.expenses, currency)}</dd></div><div><dt>{Number(active.profit) < 0 ? 'Net loss' : 'Net profit'}</dt><dd>{money(active.profit, currency)}</dd></div></dl>
    </> : <div className="pnl-chart-empty"><Icon name="chartLine" size={32} /><strong>No posted activity in this period</strong><p>Recorded revenue and expenses will appear here.</p></div>}</div>
  </section>
}
