import AnimatedMoney from './AnimatedMoney.jsx'
import ProfitLossChart from './ProfitLossChart.jsx'
import Icon from './Icon.jsx'

export default function ProfitLossOverview({ data, from, to }) {
  const loss = data.profit.startsWith('-')
  return <section className="pnl-currency-section" aria-label={`${data.currency} profit and loss overview`}>
    <div className="pnl-currency-heading"><span className="pnl-currency-pill">{data.currency}</span><p>Cash performance · Posted transactions</p></div>
    <div className="pnl-metrics">
      {[{ key: 'profit', label: loss ? 'Net loss' : 'Net profit', icon: 'chartLine', note: 'Revenue minus expenses', style: loss ? 'is-loss' : 'is-profit' }, { key: 'revenue', label: 'Revenue', icon: 'arrowDown', note: 'Money received', style: 'is-revenue' }, { key: 'expenses', label: 'Expenses', icon: 'arrowUp', note: 'Money paid', style: 'is-expense' }].map(metric => <article key={metric.key} className={'card pnl-metric ' + metric.style}><div><span>{metric.label}</span><Icon name={metric.icon} size={20} /></div><strong><AnimatedMoney amount={data[metric.key]} currency={data.currency} /></strong><p>{metric.note}</p></article>)}
    </div>
    <ProfitLossChart months={data.months} from={from} to={to} currency={data.currency} />
  </section>
}
