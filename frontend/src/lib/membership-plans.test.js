import { describe, it, expect } from 'vitest'
import { membershipDuration, membershipPrice, filterMembershipPlans } from './membership-plans.js'

describe('membership display and filtering', () => {
  const plans = [{ name: 'Monthly', description: 'Gym access', currency: 'USD', price: '25.50', durationCount: 1, durationUnit: 'month', active: true }, { name: 'Trial', description: 'One week', currency: 'LBP', price: '0.00', durationCount: 7, durationUnit: 'day', active: false }]
  it('formats zero, large LBP and fractional USD without losing cents', () => {
    expect(membershipPrice(plans[0]).replace(/\s/g, ' ')).toBe('USD 25.50')
    expect(membershipPrice(plans[1]).replace(/\s/g, ' ')).toBe('LBP 0.00')
    expect(membershipPrice({ currency: 'LBP', price: '9999999999.99' }).replace(/\s/g, ' ')).toBe('LBP 9,999,999,999.99')
  })
  it('labels calendar durations without treating months as 30 days', () => {
    expect(membershipDuration(plans[0])).toBe('1 month')
    expect(membershipDuration(plans[1])).toBe('7 days')
  })
  it('combines search and archive status without hiding archived prices from all plans', () => {
    expect(filterMembershipPlans(plans, 'active', '')).toEqual([plans[0]])
    expect(filterMembershipPlans(plans, 'archived', '')).toEqual([plans[1]])
    expect(filterMembershipPlans(plans, 'all', ' lbp ')).toEqual([plans[1]])
    expect(filterMembershipPlans(plans, 'all', 'GYM')).toEqual([plans[0]])
    expect(filterMembershipPlans(plans, 'active', 'trial')).toEqual([])
  })
})
