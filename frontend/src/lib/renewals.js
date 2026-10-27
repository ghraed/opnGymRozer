// Dates are exclusive at the end, matching the API's subscription boundaries.
export function renewalEnd(startsOn, plan) {
  const start = new Date(startsOn + 'T00:00:00Z')
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== startsOn) return null
  const count = Number(plan.durationCount)
  if (!Number.isInteger(count) || count < 1 || count > 3650) return null
  let end
  if (['day', 'week'].includes(plan.durationUnit)) {
    end = new Date(start)
    end.setUTCDate(end.getUTCDate() + count * (plan.durationUnit === 'week' ? 7 : 1))
  } else if (['month', 'year'].includes(plan.durationUnit)) {
    end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + count * (plan.durationUnit === 'year' ? 12 : 1), 1))
    const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
    end.setUTCDate(Math.min(start.getUTCDate(), last))
  } else return null
  return end.getUTCFullYear() > 9999 ? null : end.toISOString().slice(0, 10)
}

export function renewalMembers(users, subscriptions, plans, today) {
  const monthly = plans.filter(p => p.active && p.durationUnit === 'month' && p.durationCount === 1)
  return users.filter(u => u.role === 'client').map(user => {
    const history = subscriptions.filter(s => s.memberId === user.id).sort((a, b) => b.endsOn.localeCompare(a.endsOn))
    const terms = history.filter(s => s.status !== 'cancelled')
    const current = terms.find(s => s.startsOn <= today && s.endsOn > today)
    const latest = terms[0]
    const startsOn = latest?.endsOn > today ? latest.endsOn : today
    const status = current ? 'active' : terms.some(s => s.startsOn > today) ? 'scheduled' : latest ? 'expired' : 'none'
    const lastMonthly = terms.find(s => monthly.some(p => p.id === s.planId))
    return { ...user, history, current, latest, startsOn, status,
      quickPlan: monthly.find(p => p.id === lastMonthly?.planId) || monthly[0] || null }
  })
}

export function renewalHistory(member, today) {
  const history = [...member.history].sort((a, b) => b.startsOn.localeCompare(a.startsOn) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || String(a.id).localeCompare(String(b.id)))
  const upcoming = history.filter(term => term.status !== 'cancelled' && term.startsOn > today).sort((a, b) => a.startsOn.localeCompare(b.startsOn))
  const current = member.current
  const day = date => Date.parse(date + 'T00:00:00Z') / 86400000
  const daysLeft = current ? Math.max(0, Math.round(day(current.endsOn) - day(today))) : null
  const duration = current ? day(current.endsOn) - day(current.startsOn) : 0
  const progress = duration > 0 ? Math.max(0, Math.min(100, Math.round((day(today) - day(current.startsOn)) / duration * 100))) : 0
  return { history, upcoming, current, daysLeft, progress, paidCount: history.filter(term => term.paymentStatus === 'paid').length }
}
