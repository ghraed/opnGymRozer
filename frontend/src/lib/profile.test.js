import { describe, it, expect } from 'vitest'
import { profileComplete, profileStepError } from './profile.js'
import { applyOnboarding } from './onboarding.js'

const valid = { goal: 'muscle', currentWeight: 80, height: 175, days: 3, experience: 'beginner', equipment: 'full_gym', body: 'none', completedAt: 123 }
describe('required fitness profile', () => {
  it('requires every step, not just a completed timestamp', () => {
    expect(profileComplete(valid)).toBe(true)
    expect(profileComplete({ completedAt: 123 })).toBe(false)
    for (const field of Object.keys(valid)) {
      const incomplete = { ...valid }; delete incomplete[field]
      expect(profileComplete(incomplete), field).toBe(false)
    }
  })
  it('rejects invalid measurements, choices, and training frequency', () => {
    for (const value of [0, -1, Infinity, NaN, '', true, [80], {}]) {
      expect(profileComplete({ ...valid, currentWeight: value })).toBe(false)
      expect(profileComplete({ ...valid, height: value })).toBe(false)
    }
    for (const days of [1, 7, 3.5, true]) expect(profileComplete({ ...valid, days })).toBe(false)
    expect(profileStepError({ ...valid, equipment: 'invalid' }, 1)).toBeTruthy()
    expect(profileComplete({ ...valid, currentWeight: '80.5', height: '175.5' })).toBe(true)
  })
  it('requires a lower target weight for a weight-loss goal', () => {
    for (const targetWeight of [null, 0, 80, 90]) expect(profileComplete({ ...valid, goal: 'lose_weight', targetWeight })).toBe(false)
    expect(profileComplete({ ...valid, goal: 'lose_weight', targetWeight: 75 })).toBe(true)
  })
  it('validates optional program and sex choices while accepting existing profiles', () => {
    expect(profileComplete(valid)).toBe(true)
    for (const sex of ['male', 'female', 'unspecified']) {
      for (const programId of ['full_body', 'upper_lower', 'ppl', 'bro_split', null]) {
        expect(profileComplete({ ...valid, sex, programId })).toBe(true)
      }
    }
    expect(profileComplete({ ...valid, sex: 'invalid' })).toBe(false)
    expect(profileComplete({ ...valid, programId: 'invalid' })).toBe(false)
  })
  it('preserves an assigned plan and workout history while completing a profile', () => {
    const state = { routines: [{ id: 'trainer-plan', ex: [] }], week: { 1: 'trainer-plan' }, dayPlan: { '2026-10-01': 'rest' }, workouts: [{ id: 'history' }], bodyweight: [] }
    const original = JSON.parse(JSON.stringify(state))
    applyOnboarding(state, valid, 123, { preservePlan: true })
    expect(profileComplete(state.onboarding)).toBe(true)
    for (const field of ['routines', 'week', 'dayPlan', 'workouts']) expect(state[field]).toEqual(original[field])
    expect(state.bodyweight.at(-1).w).toBe(80)
  })
  it('accepts new constraints and rejects malformed values without requiring them on older profiles', () => {
    expect(profileComplete({ ...valid, sessionMinutes: 45, recovery: 'limited', hasBench: false, hasPullStation: true })).toBe(true)
    for (const [field, values] of Object.entries({ sessionMinutes: [0, 20, 61, true, [60]], recovery: ['bad', true], hasBench: ['true', 1], hasPullStation: ['false', 0] })) {
      for (const value of values) expect(profileComplete({ ...valid, [field]: value }), field).toBe(false)
    }
  })
})
