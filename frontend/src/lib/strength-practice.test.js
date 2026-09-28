import { describe, expect, it } from 'vitest'
import { applyOnboarding, applyPersonalizedProgram, buildOnboardingProgram } from './onboarding.js'
import { STRENGTH_PATTERNS, strengthLiftOptions, strengthLiftsFor } from './training-movements.js'
import { countWeeklyVolume } from './training-volume.js'

const base = { goal: 'strength', experience: 'intermediate', equipment: 'full_gym', sessionMinutes: 90 }
const lifting = plan => plan.routines.filter(routine => routine.program !== 'cardio')

describe('protected strength lift practice', () => {
  it('repeats the exact chosen lift in feasible full-body, upper/lower and six-day PPL plans', () => {
    for (const equipment of ['full_gym', 'dumbbells', 'bodyweight']) {
      for (const experience of ['beginner', 'intermediate', 'advanced']) {
        for (const [programId, days] of [['full_body', 3], ['upper_lower', 4], ['ppl', 6]]) {
          const profile = { ...base, equipment, experience, programId, days, hasPullStation: equipment === 'bodyweight' }
          const plan = buildOnboardingProgram(profile)
          expect(plan.status, `${equipment} ${experience} ${programId}`).not.toBe('NO_FEASIBLE_PLAN')
          expect(plan.evidence.strengthLifts).toEqual(strengthLiftsFor(profile))
          for (const practice of plan.evidence.strengthPractice) {
            expect(practice.sessions, `${equipment} ${experience} ${programId} ${practice.pattern}`).toBe(2)
            expect(practice.shortfall).toBe(0)
            expect(lifting(plan).filter(routine => routine.ex.some(entry =>
              entry.id === practice.id && entry.strengthLiftPattern === practice.pattern))
              .reduce((sum, routine) => sum + Object.values(plan.week).filter(id => id === routine.id).length, 0)).toBe(2)
          }
          for (const routine of lifting(plan)) {
            expect(routine.estimatedMinutes).toBeLessThanOrEqual(90)
            for (const entry of routine.ex) expect(entry.sets).toBe(3)
            for (const muscle of Object.values(countWeeklyVolume([routine], { 1: routine.id }))) {
              expect(muscle.total).toBeLessThanOrEqual(10)
            }
          }
        }
      }
    }
  })

  it('keeps explicit lift IDs and reports a soft practice shortfall in restrictive splits', () => {
    const strengthLifts = { squat: '0739', hinge: '0032', press: '0426', pull: '2330' }
    const full = buildOnboardingProgram({ ...base, programId: 'full_body', days: 3, strengthLifts })
    expect(full.status).not.toBe('NO_FEASIBLE_PLAN')
    expect(full.evidence.strengthLifts).toEqual(strengthLifts)
    expect(full.evidence.strengthPractice.every(practice => practice.sessions === 2)).toBe(true)
    const bro = buildOnboardingProgram({ ...base, programId: 'bro_split', days: 5, sessionMinutes: 60, strengthLifts })
    expect(bro.status).toBe('VALID_PLAN_WITH_SOFT_TRADEOFFS')
    expect(bro.evidence.strengthPractice.every(practice => practice.sessions >= 1)).toBe(true)
    expect(bro.evidence.strengthPractice.some(practice => practice.shortfall > 0)).toBe(true)
    const short = buildOnboardingProgram({ ...base, programId: 'upper_lower', days: 2, sessionMinutes: 45 })
    expect(short.status).toBe('VALID_PLAN_WITH_SOFT_TRADEOFFS')
    expect(short.evidence.strengthPractice.every(practice => practice.sessions >= 1)).toBe(true)
    expect(short.evidence.strengthPractice.some(practice => practice.shortfall > 0)).toBe(true)
    expect(lifting(short).every(routine => routine.estimatedMinutes <= 45)).toBe(true)
    const overheadShort = buildOnboardingProgram({ ...base, programId: 'full_body', days: 2,
      sessionMinutes: 45, strengthLifts })
    expect(overheadShort.status).toBe('VALID_PLAN_WITH_SOFT_TRADEOFFS')
    expect(overheadShort.evidence.strengthPractice.every(practice => practice.sessions >= 1)).toBe(true)
    expect(overheadShort.evidence.strengthPractice.some(practice => practice.shortfall > 0)).toBe(true)
    expect(overheadShort.evidence.weeklyVolume.find(muscle => muscle.muscle === 'chest').total).toBeGreaterThan(0)
  })

  it('ranks feasible strength splits by repeat practice before muscle workload', () => {
    const plan = buildOnboardingProgram({ ...base, days: 4 })
    expect(plan.status).not.toBe('NO_FEASIBLE_PLAN')
    expect(plan.alternatives[0].practiceShortfall).toBe(Math.min(...plan.alternatives.map(option => option.practiceShortfall)))
  })

  it('requires a new choice when a saved lift becomes unavailable', () => {
    const profile = { ...base, equipment: 'dumbbells', hasBench: true, programId: 'full_body', days: 3 }
    const strengthLifts = { ...strengthLiftsFor(profile), press: '0289' }
    expect(strengthLiftOptions(profile).press.some(option => option.id === strengthLifts.press)).toBe(true)
    const blocked = buildOnboardingProgram({ ...profile, hasBench: false, strengthLifts })
    expect(blocked).toMatchObject({ status: 'NO_FEASIBLE_PLAN', blockingReasons: [
      expect.objectContaining({ code: 'STRENGTH_LIFT_UNAVAILABLE', pattern: 'press' }),
    ] })
    const suggested = buildOnboardingProgram({ ...profile, hasBench: false })
    expect(suggested.status).not.toBe('NO_FEASIBLE_PLAN')
    expect(Object.keys(suggested.evidence.strengthLifts)).toEqual(Object.keys(STRENGTH_PATTERNS))
  })

  it('persists selected lifts and the practice assessment without changing workout history', () => {
    const profile = { ...base, days: 3, programId: 'full_body', currentWeight: 80, height: 175,
      strengthLifts: { squat: '0739', hinge: '0032', press: '0426', pull: '2330' } }
    const state = { unit: 'kg', bodyweight: [], routines: [], week: {}, dayPlan: {}, customEx: [],
      workouts: [{ id: 'completed' }] }
    const plan = applyOnboarding(state, profile, 123)
    expect(plan.status).not.toBe('NO_FEASIBLE_PLAN')
    expect(state.onboarding.strengthLifts).toEqual(profile.strengthLifts)
    expect(state.onboarding.trainingAssessment.strengthPractice).toEqual(plan.evidence.strengthPractice)
    const next = buildOnboardingProgram({ ...profile, programId: 'upper_lower', days: 4 })
    expect(applyPersonalizedProgram(state, next)).toBe(true)
    expect(state.onboarding.strengthLifts).toEqual(profile.strengthLifts)
    expect(state.workouts).toEqual([{ id: 'completed' }])
  })
})
