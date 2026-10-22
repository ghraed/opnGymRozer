export const FINANCE_FEATURES = [
  { id: 'plans', title: 'Membership plans & pricing', route: '/admin/memberships', action: 'Manage plans',
    description: 'Define the packages your gym offers, what they include and how much each term costs.',
    features: ['Set a name, benefits, duration and total price.', 'Choose USD or LBP, including free plans.', 'Edit, archive or restore plans without removing saved records.'],
    access: 'Admin → Finance → Membership plans & pricing',
    tip: 'Use a duration of 1 month, 3 months or 1 year for monthly, quarterly or yearly subscriptions.' },
  { id: 'subscriptions', title: 'Member subscriptions', route: '/admin/subscriptions', action: 'Manage subscriptions',
    description: 'Assign a monthly, quarterly or yearly membership to a client and keep a clear history of their coverage.',
    features: ['Choose the member, pricing plan and start date.', 'See active, scheduled, expired and cancelled terms.', 'Add a future term or cancel a current term with a recorded reason.'],
    access: 'Admin → Finance → Member subscriptions',
    tip: 'Each subscription keeps its agreed plan name, price and currency, even when you update the pricing catalog.' },
  { id: 'renewals', title: 'Renewals & payment reminders', route: '/admin/renewals', action: 'Open renewal tracker',
    description: 'Follow up on expiring terms, review payment status and remind members before or after a due date.',
    features: ['Track upcoming expiries, overdue renewals and terms with a next membership booked.', 'Record paid, unpaid, waived or unreviewed status with a due date and review history.', 'Send private in-app reminders, with push where enabled, or configure automatic follow-ups.'],
    access: 'Admin → Finance → Renewals & payment reminders',
    tip: 'Payment reminders stop after paid or waived reviews. Renewal reminders stop when a next term is recorded.' },

]
export const financeDate = value => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z'))
export function filterSubscriptions(subscriptions, status, query) {
  const needle = query.trim().toLocaleLowerCase()
  return subscriptions.filter(s => (status === 'all' || s.status === status) && (!needle || [s.memberName, s.memberEmail, s.planName, s.cycle, s.currency].filter(Boolean).some(value => value.toLocaleLowerCase().includes(needle))))
}
