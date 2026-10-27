import { describe, expect, it } from 'vitest'
import { amountCents, centsAmount, interpolateAmount, profitSeries, profitScale } from './profit-loss.js'

describe('profit and loss number animation', () => {
  it('preserves cents and signs beyond Number precision', () => {
    for (const amount of ['0.00', '0.01', '-0.01', '-1234.50', '999999999999999.99']) {
      expect(centsAmount(amountCents(amount))).toBe(amount)
      expect(interpolateAmount(amount, 0)).toBe('0.00')
      expect(interpolateAmount(amount, 1)).toBe(amount)
    }
    expect(interpolateAmount('999999999999999.99', .5)).toBe('499999999999999.99')
    expect(interpolateAmount('-100.50', .5)).toBe('-50.25')
  })
  it('clamps animation progress to valid display values', () => {
    expect(interpolateAmount('10.01', -1)).toBe('0.00')
    expect(interpolateAmount('10.01', 2)).toBe('10.01')
    expect(interpolateAmount('10.01', NaN)).toBe('0.00')
  })
})

describe('profit and loss chart data', () => {
  it('fills missing months with zero and keeps net losses below zero', () => {
    const months = [{ month: '2028-01', revenue: '100.10', expenses: '20.00' }, { month: '2028-03', revenue: '10.00', expenses: '50.01' }]
    const series = profitSeries(months, '2028-01-15', '2028-03-22')
    expect(series.bucketMonths).toBe(1)
    expect(series.points.map(point => [point.month, point.revenue, point.expenses, point.profit])).toEqual([
      ['2028-01', '100.10', '20.00', '80.10'], ['2028-02', '0.00', '0.00', '0.00'], ['2028-03', '10.00', '50.01', '-40.01'],
    ])
    expect(months).toHaveLength(2)
  })
  it('excludes months outside the selected period and handles a single empty month', () => {
    const result = profitSeries([{ month: '2027-12', revenue: '50.00', expenses: '0.00' }], '2028-01-01', '2028-01-31')
    expect(result.points).toEqual([{ month: '2028-01', lastMonth: '2028-01', revenue: '0.00', expenses: '0.00', profit: '0.00' }])
    expect(profitSeries([], '2028-02-01', '2028-01-01').points).toEqual([])
  })
  it('bounds chart size for long ranges while preserving exact totals and final partial periods', () => {
    const { points, bucketMonths } = profitSeries([{ month: '2000-01', revenue: '999999999999999.99', expenses: '0.01' }, { month: '2100-12', revenue: '0.01', expenses: '20.00' }], '2000-01-01', '2100-12-31')
    expect(points.length).toBeLessThanOrEqual(60)
    expect(bucketMonths).toBeGreaterThan(1)
    expect(points[0].month).toBe('2000-01')
    expect(points.at(-1).lastMonth).toBe('2100-12')
    expect(centsAmount(points.reduce((sum, point) => sum + amountCents(point.revenue), 0n))).toBe('1000000000000000.00')
    expect(centsAmount(points.reduce((sum, point) => sum + amountCents(point.profit), 0n))).toBe('999999999999979.99')
  })
  it('scales both sides of zero without collapsing for empty or zero data', () => {
    const points = [{ revenue: '20.00', expenses: '100.00', profit: '-80.00' }]
    const scale = profitScale(points)
    expect(scale.min).toBeLessThanOrEqual(-80)
    expect(scale.max).toBeGreaterThanOrEqual(100)
    expect(scale.ticks).toContain(0)
    for (const values of [[], [{ revenue: '0.00', expenses: '0.00', profit: '0.00' }], [{ revenue: '0.01', expenses: '0.00', profit: '0.01' }]]) {
      const range = profitScale(values)
      expect(range.max).toBeGreaterThan(range.min)
      expect(range.ticks.every(Number.isFinite)).toBe(true)
    }
  })
})
