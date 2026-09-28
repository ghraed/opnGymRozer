import { describe, expect, it } from 'vitest'
import { countWeeklyVolume, estimateSessionMinutes } from './training-volume.js'
import { buildOnboardingProgram, applyOnboarding } from './onboarding.js'
import { muscleCreditFor, selectMovement } from './training-movements.js'
import { buildSets } from './history.js'

const profile = { goal: 'muscle', days: 4, experience: 'intermediate', equipment: 'full_gym', currentWeight: 80, height: 188, sex: 'male' }
const totalSets = plan => Object.values(plan.week).reduce((sum, id) => sum + plan.routines.find(r => r.id === id).ex.filter(e => e.mode !== 'cardio').reduce((n, e) => n + e.sets, 0), 0)
const muscle = (plan, name) => plan.evidence.weeklyVolume.find(m => m.muscle === name)

describe('weekly workload accounting and personalization', () => {
  it('never shrinks or expands the three-set prescription for time, recovery, or old workout history', () => {
    for (const programId of ['full_body', 'upper_lower', 'ppl', 'bro_split']) {
      for (const sessionMinutes of [30, 45, 60, 75, 90]) {
        for (const recovery of ['normal', 'limited']) {
          const plan = buildOnboardingProgram({ ...profile, programId, sessionMinutes, recovery, days: 2 })
          if (plan.status === 'NO_FEASIBLE_PLAN') {
            expect(plan.blockingReasons).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'MISSING_MUSCLE_COVERAGE' })]))
            continue
          }
          for (const routine of plan.routines) {
            expect(routine.estimatedMinutes).toBeLessThanOrEqual(sessionMinutes)
            for (const entry of routine.ex.filter(e => e.mode !== 'cardio')) {
              expect(entry.sets).toBe(3)
              for (const previousCount of [1, 5]) {
                const history = { exWeights: {}, workouts: [{ entries: [{ id: entry.id,
                  sets: Array.from({ length: previousCount }, () => ({ done: true, w: 10, r: 12 })),
                }] }] }
                expect(buildSets(history, entry)).toHaveLength(3)
              }
            }
          }
        }
      }
    }
  })
  it('balances the two-day beginner focus without losing weekly muscle coverage', () => {
    const novice = { ...profile, days: 2, experience: 'beginner', programId: 'full_body', sessionMinutes: 60 }
    const male = buildOnboardingProgram(novice)
    const female = buildOnboardingProgram({ ...novice, sex: 'female' })
    expect(male.status).not.toBe('NO_FEASIBLE_PLAN')
    expect(muscle(male, 'shoulders')).toMatchObject({ target: 6 })
    expect(muscle(male, 'shoulders').total).toBeLessThanOrEqual(9)
    expect(male.evidence.missingMuscles).toEqual([])
    expect(female.evidence.missingMuscles).toEqual([])
    expect(muscle(female, 'glutes').direct).toBeGreaterThan(muscle(male, 'glutes').direct)
    const maleEntries = male.routines.flatMap(routine => routine.ex)
    expect(maleEntries.some(entry => entry.mainLift && (entry.muscles.back === 1 || entry.muscles.shoulders === 1))).toBe(true)
    expect(maleEntries.some(entry => !entry.mainLift && (entry.muscles.back === 1 || entry.muscles.shoulders === 1))).toBe(true)
    for (const plan of [male, female]) {
      expect(plan.routines.every(routine => routine.estimatedMinutes <= 60)).toBe(true)
      expect(plan.evidence.overshootScore).toBeCloseTo(plan.evidence.weeklyVolume.reduce((sum, row) =>
        sum + 2 * (Math.max(0, row.total - row.target) / row.target) ** 2, 0))
    }
  })

  it('counts direct and half-credit indirect work on every scheduled occurrence', () => {
    const routines = [{ id: 'push', ex: [
      { sets: 3, muscles: { chest: 1, triceps: 0.5 } },
      { sets: 2, muscles: { triceps: 1 } },
    ] }, { id: 'unused', ex: [{ sets: 100, muscles: { chest: 1 } }] }]
    const volume = countWeeklyVolume(routines, { 1: 'push', 4: 'push', 5: 'missing' })
    expect(volume.chest).toEqual({ direct: 6, indirect: 0, total: 6, sessions: 2 })
    expect(volume.triceps).toEqual({ direct: 4, indirect: 3, total: 7, sessions: 2 })
    expect(volume.back).toEqual({ direct: 0, indirect: 0, total: 0, sessions: 0 })
  })

  it('budgets warm-up, setup, repetitions, rests between sets, and cardio', () => {
    expect(estimateSessionMinutes({ ex: [
      { sets: 3, reps: 10, rest: 120 }, { sets: 1, mode: 'cardio', min: 10 },
    ] })).toBe(21.5) // 5 + 1 + 90 seconds of repetitions + 4 minutes resting + 10 cardio.
  })

  it('estimates unilateral reps, setup, rest, and set count independently', () => {
    const base = { sets: 3, reps: 10, rest: 60, executionMode: 'bilateral', setupCost: 'low' }
    const estimate = entry => estimateSessionMinutes({ ex: [entry] })
    expect(estimate({ ...base, executionMode: 'unilateral' })).toBeGreaterThan(estimate(base))
    expect(estimate({ ...base, setupCost: 'high' })).toBeGreaterThan(estimate(base))
    expect(estimate({ ...base, rest: 180 })).toBeGreaterThan(estimate(base))
    expect(estimate({ ...base, sets: 4 })).toBeGreaterThan(estimate({ ...base, sets: 2 }))
    expect(selectMovement({ id: '0410' }, { equipment: 'dumbbells', experience: 'intermediate', hasBench: true }, new Set()))
      .toMatchObject({ executionMode: 'unilateral' })
    expect(selectMovement({ id: '0043' }, { equipment: 'full_gym', experience: 'intermediate' }, new Set()))
      .toMatchObject({ setupCost: 'high' })
  })

  it('keeps compounds and accessories at three sets while accounting for weekly overlap', () => {
    const plan = buildOnboardingProgram({ ...profile, programId: 'upper_lower' })
    expect(plan.evidence).toMatchObject({ minExerciseSets: 3, maxExerciseSets: 3 })
    const upper = plan.routines.find(r => r.name === 'Upper A')
    const accessories = plan.routines.flatMap(r => r.ex).filter(e => !e.compound)
    expect(new Set(upper.ex.map(e => e.sets))).toEqual(new Set([3]))
    expect(accessories.some(e => e.id === '0334' && e.repsMin === 12 && e.reps === 20)).toBe(true)
    expect(muscle(plan, 'triceps').indirect).toBeGreaterThan(0)
    expect(muscle(plan, 'triceps').direct).toBeLessThan(muscle(plan, 'triceps').target)
    for (const entry of upper.ex) expect(entry.volumeReason.length).toBeGreaterThan(0)
  })

  it('accounts for all six PPL sessions and stores the same assessment it previews', () => {
    const state = { unit: 'lb', routines: [], week: {}, workouts: [], bodyweight: [], customEx: [] }
    const plan = applyOnboarding(state, { ...profile, programId: 'ppl', days: 6, currentWeight: 176.4, unit: 'kg' })
    for (const routine of plan.routines) for (const entry of routine.ex) {
      expect(entry.sets).toBe(3)
      expect(entry.weeklyOccurrences).toBe(2)
      expect(entry.weeklySets).toBe(entry.sets * 2)
    }
    const chestSessionSets = plan.routines[0].ex.filter(e => e.muscles.chest === 1).reduce((sum, e) => sum + e.sets, 0)
    expect(muscle(plan, 'chest').direct).toBe(chestSessionSets * 2)
    expect(state.onboarding.trainingAssessment).toEqual(plan.evidence)
    expect(plan.evidence.profileFactors).toMatchObject({ weight: 176.4, height: 188, unit: 'lb', sex: 'male' })
  })

  it('reduces workload for limited recovery and adapts every split to a shorter session', () => {
    for (const programId of ['full_body', 'upper_lower', 'ppl', 'bro_split']) {
      const regular = buildOnboardingProgram({ ...profile, programId, days: 3, sessionMinutes: 90 })
      const short = buildOnboardingProgram({ ...profile, programId, days: 3, sessionMinutes: 45 })
      const returning = buildOnboardingProgram({ ...profile, programId, days: 3, sessionMinutes: 90, recovery: 'limited' })
      expect(totalSets(short)).toBeLessThan(totalSets(regular))
      expect(totalSets(returning)).toBeLessThan(totalSets(regular))
      expect(returning.evidence.target).toBeLessThan(regular.evidence.target)
      for (const routine of short.routines) expect(routine.estimatedMinutes).toBeLessThanOrEqual(45)
      for (const row of short.evidence.weeklyVolume) expect(row.shortfall).toBe(Math.max(0, row.target - row.total))
      expect(short.evidence.volumeShortfalls.length).toBeGreaterThan(0)
    }
  })

  it('caps work for a muscle in one session and uses actual exercise roles for strength', () => {
    for (const programId of ['full_body', 'upper_lower', 'ppl', 'bro_split']) {
      const plan = buildOnboardingProgram({ ...profile, goal: 'strength', experience: 'advanced', programId, days: 2, sessionMinutes: 90 })
      for (const routine of plan.routines) {
        const session = countWeeklyVolume([routine], { 1: routine.id })
        for (const row of Object.values(session)) expect(row.total).toBeLessThanOrEqual(10)
        for (const entry of routine.ex.filter(e => e.heavy)) {
          expect(entry.sets).toBe(3)
          expect(entry).toMatchObject({ repsMin: 4, reps: 6, rest: 180, weight: 0 })
        }
      }
    }
  })

  it('counts the actual substituted movement and excludes unavailable home equipment', () => {
    const pull = selectMovement({ id: '0031' }, { equipment: 'bodyweight', hasPullStation: true }, new Set())
    expect(pull.muscles).toEqual(muscleCreditFor(pull.id).muscles)
    expect(pull.muscles.biceps).toBe(0.5) // Replacing a curl with a row does not make it a direct biceps set.
    const noStation = buildOnboardingProgram({ ...profile, programId: 'ppl', equipment: 'bodyweight' })
    expect(noStation.status).toBe('NO_FEASIBLE_PLAN')
    expect(noStation.blockingReasons).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'NO_SUITABLE_EXERCISE', session: 'Pull Day' })]))
    const noBench = buildOnboardingProgram({ ...profile, equipment: 'dumbbells' })
    const ids = noBench.routines.flatMap(r => r.ex.map(e => e.id))
    expect(ids).toContain('og-db-floor-press')
    for (const id of ['0289', '0314', '0308', '0351', '0405', '0652', '1326']) expect(ids).not.toContain(id)
    expect(noBench.customEx.some(e => e.id === 'og-db-floor-press')).toBe(true)
  })
})
