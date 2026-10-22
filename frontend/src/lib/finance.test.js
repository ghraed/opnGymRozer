import { describe, it, expect } from 'vitest'
import { FINANCE_FEATURES, filterSubscriptions, financeDate } from './finance.js'

describe('finance guides and subscription search', () => {
  it('links every available finance tool with a readable access guide', () => {
    expect(FINANCE_FEATURES.map(feature => feature.route)).toEqual(['/admin/memberships', '/admin/subscriptions', '/admin/renewals'])
    for (const feature of FINANCE_FEATURES) {
      expect(feature.description.length).toBeGreaterThan(30)
      expect(feature.access).toContain('Admin → Finance →')
      expect(feature.features.length).toBeGreaterThan(0)
    }
  })
  it('keeps server-calculated status filters separate from text search', () => {
    const subscriptions = [{ memberName: 'Anna', memberEmail: 'a@test.local', planName: 'Gold', cycle: 'monthly', currency: 'USD', status: 'active' }, { memberName: 'Deleted member', memberEmail: null, planName: 'Silver', cycle: 'quarterly', currency: 'LBP', status: 'cancelled' }]
    expect(filterSubscriptions(subscriptions, 'all', 'QUARTERLY')).toEqual([subscriptions[1]])
    expect(filterSubscriptions(subscriptions, 'active', 'Anna')).toEqual([subscriptions[0]])
    expect(filterSubscriptions(subscriptions, 'active', 'LBP')).toEqual([])
    expect(filterSubscriptions(subscriptions, 'cancelled', '')).toEqual([subscriptions[1]])
    expect(financeDate('2028-02-29')).toContain('29 Feb 2028')
  })
})
