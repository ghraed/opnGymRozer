import { describe, expect, it } from 'vitest'
import { bmiFor, bmiBand, bmiPosition } from './bmi.js'

describe('BMI helpers', () => {
  it('calculates metric and imperial weights', () => {
    expect(bmiFor(70, 175, 'kg')).toBe(22.9)
    expect(bmiFor(154.324, 175, 'lb')).toBe(22.9)
  })

  it('uses the adult BMI bands', () => {
    expect(bmiBand(18.4)).toBe('underweight')
    expect(bmiBand(18.5)).toBe('healthy')
    expect(bmiBand(25)).toBe('overweight')
    expect(bmiBand(30)).toBe('obesity')
  })

  it('rejects invalid measurements and clamps graph positions', () => {
    expect(bmiFor(0, 175)).toBeNull()
    expect(bmiFor(70, 0)).toBeNull()
    expect(bmiPosition(10)).toBe(0)
    expect(bmiPosition(27.5)).toBe(50)
    expect(bmiPosition(45)).toBe(100)
  })
})
