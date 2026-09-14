import { describe, expect, it } from 'vitest'
import { EXIDX } from './exercises.js'
import { applyOnboarding, buildOnboardingProgram, selectablePrograms, programForDays, WALKING_EXERCISE } from './onboarding.js'
import { MOVEMENTS, selectMovement, EXTRA_EXERCISES } from './training-movements.js'
import { TRAINING_POLICY_VERSION, TRAINING_SOURCES } from './training-evidence.js'
import { todayISO } from './format.js'
import { buildSets, exLine, setLabel, restSecondsFor } from './history.js'

const knownExercise = (plan, id) => plan.customEx.find(ex => ex.id === id) || EXIDX[id]
const lifting = plan => plan.routines.filter(r => r.program !== 'cardio')
const stripIds = plan => ({
  programId: plan.programId,
  routines: plan.routines.map(({ name, ex }) => ({ name, ex })),
  schedule: Object.entries(plan.week).map(([day, id]) => [day, plan.routines.findIndex(r => r.id === id)]),
})

describe('research-informed onboarding recommendations', () => {
  it('fits split suggestions to availability, goals and experience', () => {
    expect([2, 3, 4, 5, 6].map(programForDays)).toEqual(['full_body', 'full_body', 'upper_lower', 'upper_lower', 'ppl'])
    expect(selectablePrograms()).toEqual(['ppl', 'upper_lower', 'full_body', 'bro_split'])
    for (let days = 2; days <= 6; days++) {
      const beginner = buildOnboardingProgram({ days, experience: 'beginner', goal: 'strength' })
      expect(beginner.programId).toBe('full_body')
      expect(beginner.evidence.resistanceDays).toBe(Math.min(days, 3))
      expect(Object.keys(beginner.week)).toHaveLength(days)
      const trained = buildOnboardingProgram({ days, experience: 'intermediate', goal: 'muscle' })
      expect(trained.programId).toBe(trained.alternatives[0].programId)
      expect(trained.alternatives).toHaveLength(4)
    }
    expect(buildOnboardingProgram({ days: 6, experience: 'advanced', goal: 'fitness' }).programId).toBe('upper_lower')
    expect(buildOnboardingProgram({ days: 6, experience: 'advanced', goal: 'lose_weight' }).programId).toBe('upper_lower')
  })

  it('preserves an explicit choice while keeping the system recommendation separate', () => {
    for (const programId of selectablePrograms()) {
      const plan = buildOnboardingProgram({ days: 5, programId, goal: 'muscle', experience: 'intermediate' })
      expect(plan.programId).toBe(programId)
      expect(plan.recommendedProgramId).toBe(plan.alternatives[0].programId)
    }
    const profile = { days: 6, programId: 'bro_split', goal: 'muscle', experience: 'beginner' }
    expect(buildOnboardingProgram(profile).programId).toBe('bro_split')
    expect(buildOnboardingProgram({ ...profile, programId: null }).programId).toBe('full_body')
    expect(buildOnboardingProgram({ ...profile, programId: 'unknown' }).programId).toBe('full_body')
  })

  it('uses reviewable exercises, source references and bounded prescriptions across all choices', () => {
    const allowedIds = new Set(Object.values(MOVEMENTS).flatMap(m => [...m.full, ...m.dumbbells, ...m.bodyweight, ...m.novice]))
    const sourceIds = TRAINING_SOURCES.map(source => source.id)
    for (const goal of ['muscle', 'strength', 'lose_weight', 'fitness']) {
      for (const experience of ['beginner', 'intermediate', 'advanced']) {
        for (const programId of selectablePrograms()) {
          for (let days = 2; days <= 6; days++) {
            for (const equipment of ['full_gym', 'dumbbells', 'bodyweight']) {
              const plan = buildOnboardingProgram({ goal, experience, programId, days, equipment })
              expect(Object.keys(plan.week)).toHaveLength(days)
              expect(new Set(Object.values(plan.week))).toEqual(new Set(plan.routines.map(r => r.id)))
              expect(plan.evidence.policyVersion).toBe(TRAINING_POLICY_VERSION)
              for (const routine of plan.routines) {
                if (!routine.ex.length) expect(plan.evidence.unavailableSessions).toContain(routine.name)
                expect(routine.estimatedMinutes).toBeLessThanOrEqual(plan.evidence.sessionMinutes)
                expect(new Set(routine.ex.map(e => e.id)).size).toBe(routine.ex.length)
                for (const entry of routine.ex) {
                  const exercise = knownExercise(plan, entry.id)
                  expect(exercise, entry.id).toBeTruthy()
                  if (equipment === 'bodyweight') expect(exercise.eq).toBe('body weight')
                  if (equipment === 'dumbbells') expect(['body weight', 'dumbbell']).toContain(exercise.eq)
                  expect(entry.sourceIds.length).toBeGreaterThan(0)
                  expect(entry.sourceIds.every(id => sourceIds.includes(id))).toBe(true)
                  expect(entry.weight).toBe(0) // No invented load from anthropometrics.
                  if (entry.mode === 'cardio') {
                    expect(entry.min).toBeGreaterThan(0)
                    expect(entry.min).toBeLessThanOrEqual(plan.evidence.sessionMinutes - 5)
                    expect(entry.speed).toBe(0)
                  } else {
                    expect(allowedIds.has(entry.id)).toBe(true)
                    expect([6, 12, 15, 20]).toContain(entry.reps)
                    expect(entry.prescriptionSourceIds.every(id => sourceIds.includes(id))).toBe(true)
                    expect(entry.sets).toBe(3)
                    if (experience === 'beginner') {
                      expect(entry.sets).toBeLessThanOrEqual(3)
                      expect(entry.reps).toBeGreaterThanOrEqual(8)
                      expect(['0652', '1326', '0032', '0043']).not.toContain(entry.id)
                    }
                    if (entry.heavy) {
                      expect(goal).toBe('strength')
                      expect(entry.mainLift).toBe(true)
                      expect(entry.rest).toBe(180)
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, 30000)

  it('leaves recovery days between full-body lifting, including across week boundaries', () => {
    for (let days = 2; days <= 6; days++) {
      const plan = buildOnboardingProgram({ days, programId: 'full_body', goal: 'strength', experience: 'intermediate' })
      const resistanceIds = new Set(lifting(plan).map(r => r.id))
      for (let day = 0; day < 7; day++) {
        if (resistanceIds.has(plan.week[day])) expect(resistanceIds.has(plan.week[(day + 1) % 7])).toBe(false)
      }
      expect(plan.evidence.resistanceDays + plan.evidence.aerobicDays).toBe(days)
    }
    const upper = buildOnboardingProgram({ days: 5, programId: 'upper_lower', goal: 'muscle' })
    expect(upper.evidence).toMatchObject({ resistanceDays: 4, aerobicDays: 1 })
    const ppl = buildOnboardingProgram({ days: 6, programId: 'ppl', goal: 'muscle' })
    lifting(ppl).forEach(routine => expect(Object.values(ppl.week).filter(id => id === routine.id)).toHaveLength(2))
  })

  it('explains adaptations for low-frequency splits instead of silently dropping body-part days', () => {
    const plan = buildOnboardingProgram({ days: 2, programId: 'bro_split', goal: 'muscle', experience: 'intermediate' })
    expect(plan.evidence).toMatchObject({ combinedSplit: true, lowFrequencySplit: true })
    const movements = new Set(lifting(plan).flatMap(r => r.ex.map(ex => ex.movement)))
    for (const movement of ['Horizontal push', 'Horizontal pull', 'Squat / knee extension', 'Overhead push', 'Elbow flexion']) expect(movements.has(movement), movement).toBe(true)
    expect(buildOnboardingProgram({ days: 2, programId: 'full_body' }).evidence.combinedSplit).toBe(false)
  })

  it('adapts movements to experience and equipment without arbitrary library fallbacks', () => {
    expect(selectMovement({ id: 'not-reviewed' }, { equipment: 'full_gym' }, new Set())).toBeNull()
    expect(selectMovement({ id: '0043' }, { equipment: 'full_gym', experience: 'beginner' }, new Set()).id).toBe('1760')
    expect(selectMovement({ id: '0043' }, { equipment: 'full_gym', experience: 'advanced' }, new Set()).id).toBe('0043')
    expect(selectMovement({ id: '0426' }, { equipment: 'bodyweight' }, new Set())).toBeNull() // A push-up is not an overhead press.
    const pull = selectMovement({ id: '2330' }, { equipment: 'dumbbells' }, new Set())
    expect(pull).toMatchObject({ id: '0293', movement: 'Horizontal pull', adaptation: expect.any(String) })
    expect(buildOnboardingProgram({ equipment: 'bodyweight' }).evidence.bodyweightEquipment).toBe(true)
  })

  it('starts aerobic work gradually, accounts for every scheduled minute and flags limitations', () => {
    const plan = buildOnboardingProgram({ days: 5, goal: 'lose_weight', experience: 'beginner', equipment: 'bodyweight', injuryNote: 'knee pain' })
    expect(plan.evidence).toMatchObject({ resistanceDays: 3, aerobicDays: 2, cardioMinutes: 50, additionalCardioMinutes: 100, needsProfessionalReview: true })
    const cardio = plan.routines.flatMap(r => r.ex).filter(e => e.mode === 'cardio')
    expect(cardio.every(e => e.id === WALKING_EXERCISE.id && e.min === 10)).toBe(true)
    const trained = buildOnboardingProgram({ days: 6, programId: 'ppl', goal: 'lose_weight', experience: 'advanced', equipment: 'full_gym' })
    expect(trained.evidence.cardioMinutes).toBe(90) // Count repeated sessions, not just unique routines.
    expect(trained.evidence.additionalCardioMinutes).toBe(60)
  })

  it('does not invent sex- or BMI-based loads and splits, or use the diagram as sex', () => {
    const base = { goal: 'strength', days: 4, experience: 'intermediate', equipment: 'full_gym' }
    const expected = stripIds(buildOnboardingProgram(base))
    for (const sex of ['female', 'male', 'unspecified']) {
      for (const [currentWeight, height, unit] of [[55, 155, 'kg'], [130, 195, 'kg'], [286.6, 195, 'lb']]) {
        expect(stripIds(buildOnboardingProgram({ ...base, sex, body: 'female', currentWeight, height, unit }))).toEqual(expected)
      }
    }
  })

  it('carries comfortable-pace cardio and prescribed rest into actual workout logging', () => {
    const plan = buildOnboardingProgram({ goal: 'fitness', days: 3, equipment: 'dumbbells' })
    const cfg = plan.routines[0].ex.find(entry => entry.mode === 'cardio')
    const sets = buildSets({ workouts: [], exWeights: {} }, cfg)
    expect(sets).toEqual([{ min: 10, speed: 0, done: false }])
    expect(exLine(cfg, 'kg')).toBe('1 × 10 min')
    expect(setLabel(cfg.id, sets[0], cfg)).toBe('10 min')
    expect(restSecondsFor({ rest: 180 }, 60)).toBe(180)
    for (const rest of [undefined, null, -1, NaN, '180']) expect(restSecondsFor({ rest }, 60)).toBe(60)
  })

  it('saves the chosen program, custom aerobic exercise, profile and provenance without erasing history', () => {
    const state = { body: 'male', bodyweight: [], targetW: null, routines: [{ id: 'old' }], customEx: [], week: {}, dayPlan: { '2099-01-01': 'rest' }, workouts: [{ id: 'completed' }] }
    applyOnboarding(state, { goal: 'lose_weight', currentWeight: 82.4, height: 175.5, targetWeight: 75, days: 3, body: 'female', sex: 'unspecified', programId: 'bro_split', equipment: 'dumbbells' }, 123)
    expect(state.onboarding).toMatchObject({ completedAt: 123, currentWeight: 82.4, height: 175.5, targetWeight: 75, programId: 'bro_split', trainingPolicyVersion: TRAINING_POLICY_VERSION, sex: 'unspecified' })
    expect(state.bodyweight).toEqual([{ d: todayISO(), w: 82.4, t: 123 }])
    expect(state.targetW).toBe(75)
    expect(state.body).toBe('female')
    expect(state.workouts).toEqual([{ id: 'completed' }])
    expect(state.routines[0]).toEqual({ id: 'old' })
    expect(Object.keys(state.week)).toHaveLength(3)
    expect(Object.values(state.week).every(id => state.routines.some(r => r.id === id))).toBe(true)
    expect(state.dayPlan).toEqual({})
    expect(state.customEx).toEqual([WALKING_EXERCISE, ...EXTRA_EXERCISES])
    expect(state.onboarding.trainingAssessment.weeklyVolume).toHaveLength(10)
  })
})
