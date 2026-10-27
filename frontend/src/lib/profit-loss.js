export function amountCents(value) {
  const [whole, fraction = ''] = String(value).split('.')
  const negative = whole.startsWith('-')
  const absolute = BigInt(whole.replace('-', '')) * 100n + BigInt(fraction.padEnd(2, '0'))
  return negative ? -absolute : absolute
}
export function centsAmount(value) {
  const absolute = value < 0n ? -value : value
  return `${value < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`
}
export function interpolateAmount(value, progress) {
  const fraction = BigInt(Math.round(Math.max(0, Math.min(1, Number(progress) || 0)) * 1000000))
  return centsAmount(amountCents(value) * fraction / 1000000n)
}
const monthIndex = date => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1
const monthText = index => `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}`

// Fill inactive months with zero, and group very wide ranges into at most 60 periods.
// Every aggregate stays in integer cents; only plot coordinates use floating point.
export function profitSeries(months, from, to) {
  const first = monthIndex(from), last = monthIndex(to)
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return { points: [], bucketMonths: 1 }
  const bucketMonths = Math.max(1, Math.ceil((last - first + 1) / 60))
  const buckets = Array.from({ length: Math.ceil((last - first + 1) / bucketMonths) }, (_, index) => ({ month: monthText(first + index * bucketMonths), lastMonth: monthText(Math.min(last, first + (index + 1) * bucketMonths - 1)), revenue: 0n, expenses: 0n }))
  for (const row of months) {
    const index = monthIndex(row.month)
    if (!Number.isFinite(index) || index < first || index > last) continue
    const bucket = buckets[Math.floor((index - first) / bucketMonths)]
    bucket.revenue += amountCents(row.revenue)
    bucket.expenses += amountCents(row.expenses)
  }
  return { bucketMonths, points: buckets.map(row => ({ ...row, revenue: centsAmount(row.revenue), expenses: centsAmount(row.expenses), profit: centsAmount(row.revenue - row.expenses) })) }
}
export function profitScale(points) {
  const values = points.flatMap(point => [Number(point.revenue), Number(point.expenses), Number(point.profit)])
  const low = Math.min(0, ...values), high = Math.max(0, ...values)
  const raw = Math.max((high - low) / 4, .01)
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].find(value => value * power >= raw) * power
  const min = Math.floor(low / step) * step
  const max = Math.max(min + step, Math.ceil(high / step) * step)
  return { min, max, ticks: Array.from({ length: Math.round((max - min) / step) + 1 }, (_, index) => min + index * step) }
}
