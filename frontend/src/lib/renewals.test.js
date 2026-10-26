import { describe, it, expect } from 'vitest'
import { renewalEnd, renewalMembers } from './renewals.js'

describe('fast member renewals', () => {
  const plans = [{ id: 'monthly', active: true, durationCount: 1, durationUnit: 'month' }, { id: 'usual', active: true, durationCount: 1, durationUnit: 'month' }, { id: 'archived', active: false, durationCount: 1, durationUnit: 'month' }, { id: 'daily', active: true, durationCount: 1, durationUnit: 'day' }]
  it('includes clients without memberships and disabled clients, excluding staff', () => {
    const rows = renewalMembers([{ id: 'new', role: 'client' }, { id: 'disabled', role: 'client', disabled: true }, { id: 'staff', role: 'admin' }], [], plans, '2027-01-01')
    expect(rows.map(m => m.id)).toEqual(['new', 'disabled'])
    expect(rows[0]).toMatchObject({ status: 'none', startsOn: '2027-01-01', quickPlan: plans[0] })
    expect(rows[1].disabled).toBe(true)
  })
  it('extends after all booked coverage, ignores cancellations and prefers the member’s monthly plan', () => {
    const terms = [
      { id: 'current', memberId: 'a', planId: 'usual', startsOn: '2027-01-01', endsOn: '2027-02-01', status: 'active' },
      { id: 'next', memberId: 'a', startsOn: '2027-02-01', endsOn: '2027-03-01', status: 'scheduled' },
      { id: 'cancelled', memberId: 'a', startsOn: '2028-01-01', endsOn: '2028-02-01', status: 'cancelled' },
      { id: 'other', memberId: 'b', startsOn: '2029-01-01', endsOn: '2029-02-01', status: 'scheduled' },
    ]
    const [member] = renewalMembers([{ id: 'a', role: 'client' }], terms, plans, '2027-01-15')
    expect(member).toMatchObject({ status: 'active', startsOn: '2027-03-01', current: { id: 'current' }, latest: { id: 'next' }, quickPlan: plans[1] })
    expect(member.history).toHaveLength(3)
  })
  it('restarts expired coverage today and never treats a 30-day plan as one calendar month', () => {
    const [member] = renewalMembers([{ id: 'a', role: 'client' }], [{ memberId: 'a', startsOn: '2026-01-01', endsOn: '2026-02-01', status: 'expired' }], [plans[3]], '2027-01-15')
    expect(member).toMatchObject({ startsOn: '2027-01-15', status: 'expired', quickPlan: null })
  })
  it('previews day, week and calendar durations with leap years and month-end clamping', () => {
    for (const [start, durationCount, durationUnit, end] of [['2028-02-28', 2, 'day', '2028-03-01'], ['2027-12-25', 2, 'week', '2028-01-08'], ['2027-12-31', 2, 'month', '2028-02-29'], ['2028-02-29', 2, 'year', '2030-02-28'], ['2027-01-31', 1, 'month', '2027-02-28']]) expect(renewalEnd(start, { durationCount, durationUnit })).toBe(end)
    expect(renewalEnd('9999-12-31', plans[3])).toBe(null)
    expect(renewalEnd('', plans[0])).toBe(null)
  })
})
