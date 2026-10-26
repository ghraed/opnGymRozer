export const FINANCE_FEATURES = [
  { id: 'revenue', icon: 'chartLine', title: 'Revenue', route: '/admin/revenue', action: 'Manage revenue',
    description: 'Record money received from memberships, personal training, retail and other gym income.',
    features: ['Save the date, amount, currency, category and payment method.', 'Keep a description and receipt or subscription reference.', 'Filter transaction history and void mistakes with a recorded reason.'],
    access: 'Admin → Finance → Revenue', tip: 'Paid subscriptions automatically create revenue. Record other receipts here once.' },
  { id: 'expenses', icon: 'wallet', title: 'Expenses', route: '/admin/expenses', action: 'Manage expenses',
    description: 'Track money paid for rent, salaries, utilities, equipment and daily gym operations.',
    features: ['Categorise each payment and preserve its reference.', 'Review posted and voided transactions for any date range.', 'Keep original records and a reason when correcting mistakes.'],
    access: 'Admin → Finance → Expenses', tip: 'Record costs on the date paid. Void an incorrect entry and create a replacement.' },
  { id: 'profit-loss', icon: 'chart', title: 'Profit & loss', route: '/admin/profit-loss', action: 'View profit & loss',
    description: 'Understand your cash performance with revenue, expenses and net results for any period.',
    features: ['View exact totals separately for USD and LBP.', 'Compare monthly revenue, expenses and net profit or loss.', 'Review category breakdowns; voided entries are excluded.'],
    access: 'Admin → Finance → Profit & loss', tip: 'Cash-basis report: revenue minus expenses from posted ledger entries. No exchange-rate conversion or accrual accounting.' },
  { id: 'plans', title: 'Membership plans & pricing', route: '/admin/memberships', action: 'Manage plans',
    description: 'Define the packages your gym offers, what they include and how much each term costs.',
    features: ['Set a name, benefits, duration and total price.', 'Choose USD or LBP, including free plans.', 'Edit, archive or restore plans without removing saved records.'],
    access: 'Admin → Finance → Membership plans & pricing',
    tip: 'Set any duration in days, weeks, months or years. An active 1-month plan enables quick renewals.' },
  { id: 'subscriptions', title: 'Member subscriptions', route: '/admin/subscriptions', action: 'Manage subscriptions',
    description: 'Assign a membership using any plan duration and keep a clear history of client coverage.',
    features: ['Choose the member, pricing plan and start date.', 'See active, scheduled, expired and cancelled terms.', 'Add a future term or cancel a current term with a recorded reason.'],
    access: 'Admin → Finance → Member subscriptions',
    tip: 'Each subscription keeps its agreed plan name, price and currency, even when you update the pricing catalog.' },
  { id: 'renewals', title: 'Renew subscriptions', route: '/admin/renewals', action: 'Renew subscriptions',
    description: 'See every client as a card, renew for one month in two taps, or open a member to choose any plan.',
    features: ['Confirm a quick one-month renewal or choose a daily or longer membership plan.', 'Record paid, unpaid, waived or unreviewed status with a due date and review history.', 'Send private in-app reminders, with push where enabled, or configure automatic follow-ups.'],
    access: 'Admin → Finance → Renew subscriptions',
    tip: 'Payment reminders stop after paid or waived reviews. Renewal reminders stop when a next term is recorded.' },

]
export const financeDate = value => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z'))
export function filterSubscriptions(subscriptions, status, query) {
  const needle = query.trim().toLocaleLowerCase()
  return subscriptions.filter(s => (status === 'all' || s.status === status) && (!needle || [s.memberName, s.memberEmail, s.planName, s.cycle, s.currency].filter(Boolean).some(value => value.toLocaleLowerCase().includes(needle))))
}
