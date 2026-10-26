export const SUBSCRIPTION_CYCLES = { monthly: { label: 'Monthly', months: 1 }, quarterly: { label: 'Quarterly', months: 3 }, yearly: { label: 'Yearly', months: 12 } }

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && Number(value.slice(0, 4)) >= 2000
}

// Calendar periods, with month-end clamping. End date is exclusive.
export function subscriptionEnd(startsOn, cycle, plan) {
  const duration = cycle === 'plan' ? plan : { durationCount: SUBSCRIPTION_CYCLES[cycle]?.months, durationUnit: 'month' }
  if (!validDate(startsOn) || !duration || !Number.isInteger(duration.durationCount) || duration.durationCount < 1 || duration.durationCount > 3650 || !['day', 'week', 'month', 'year'].includes(duration.durationUnit)) throw new Error('Choose a valid start date and subscription period')
  const start = new Date(startsOn + 'T00:00:00Z')
  let target
  if (['day', 'week'].includes(duration.durationUnit)) {
    target = new Date(start)
    target.setUTCDate(target.getUTCDate() + duration.durationCount * (duration.durationUnit === 'week' ? 7 : 1))
  } else {
    const months = duration.durationCount * (duration.durationUnit === 'year' ? 12 : 1)
    target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1))
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
    target.setUTCDate(Math.min(start.getUTCDate(), lastDay))
  }
  if (target.getUTCFullYear() > 9999) throw new Error('End date is out of range')
  return target.toISOString().slice(0, 10)
}

export function planCycle(plan) {
  const months = plan.durationUnit === 'month' ? plan.durationCount : plan.durationUnit === 'year' ? plan.durationCount * 12 : null
  return Object.entries(SUBSCRIPTION_CYCLES).find(([, cycle]) => cycle.months === months)?.[0] || 'plan'
}

export function subscriptionStatus(subscription, today) {
  if (subscription.cancelledAt) return 'cancelled'
  if (today < subscription.startsOn) return 'scheduled'
  return today >= subscription.endsOn ? 'expired' : 'active'
}
