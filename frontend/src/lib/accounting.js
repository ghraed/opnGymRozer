// Preserve exact aggregate decimals beyond Number's safe integer range.
export function accountingMoney(amount, currency) {
  const [whole, fraction = '00'] = String(amount).split('.')
  return `${currency} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`
}
