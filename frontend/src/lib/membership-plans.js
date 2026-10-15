export const membershipDuration = plan => `${plan.durationCount} ${plan.durationUnit}${plan.durationCount === 1 ? '' : 's'}`
export const membershipPrice = plan => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: plan.currency, currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(plan.price))

export function filterMembershipPlans(plans, status, query) {
  const needle = query.trim().toLocaleLowerCase()
  return plans.filter(plan => (status === 'all' || plan.active === (status === 'active')) &&
    (!needle || [plan.name, plan.description, plan.currency].some(value => value.toLocaleLowerCase().includes(needle))))
}
