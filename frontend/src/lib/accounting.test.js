import { describe, it, expect } from 'vitest'
import { accountingMoney } from './accounting.js'
describe('accounting amounts', () => {
  it('formats large exact values, losses and currency labels without rounding', () => {
    expect(accountingMoney('999999999999999.99', 'USD')).toBe('USD 999,999,999,999,999.99')
    expect(accountingMoney('-1000.10', 'LBP')).toBe('LBP -1,000.10')
    expect(accountingMoney('0.00', 'USD')).toBe('USD 0.00')
  })
})
