import { describe, expect, it } from 'vitest'
import { EXIDX } from './exercises.js'
import { applyOnboarding, applyPersonalizedProgram, buildOnboardingProgram, selectFeasiblePlan, selectablePrograms, programForDays, WALKING_EXERCISE } from './onboarding.js'
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
      expect(beginner.programId).toBe(beginner.alternatives[0].programId)
      expect(beginner.evidence.resistanceDays).toBeGreaterThanOrEqual(2)
      expect(beginner.evidence.resistanceDays).toBeLessThanOrEqual(days)
      expect(Object.keys(beginner.week)).toHaveLength(days)
      const trained = buildOnboardingProgram({ days, experience: 'intermediate', goal: 'muscle' })
      expect(trained.programId).toBe(trained.alternatives[0].programId)
      expect(trained.alternatives).toHaveLength(4)
    }
    expect(buildOnboardingProgram({ days: 6, experience: 'advanced', goal: 'fitness' }).programId).toBe('upper_lower')
    expect(buildOnboardingProgram({ days: 6, experience: 'advanced', goal: 'lose_weight' }).programId).toBe('upper_lower')
  })

  it('uses estimated overshoot in split ranking without changing the shortfall field', () => {
    const profile = { days: 4, goal: 'muscle', experience: 'intermediate', equipment: 'full_gym' }
    const original = buildOnboardingProgram({ ...profile, programId: 'upper_lower' })
    expect(original.status).not.toBe('NO_FEASIBLE_PLAN')
    const higher = { ...original, programId: 'upper_lower', evidence: { ...original.evidence, workloadScore: 0, overshootScore: 2 } }
    const lower = { ...original, programId: 'full_body', evidence: { ...original.evidence, workloadScore: 0, overshootScore: 0 } }
    const selected = selectFeasiblePlan([higher, lower], profile)
    expect(selected.programId).toBe('full_body')
    expect(selected.alternatives.map(option => option.shortfall)).toEqual([0, 0])
    expect(selected.alternatives[0].score).toBeLessThan(selected.alternatives[1].score)
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
    expect(buildOnboardingProgram({ ...profile, selectedSplitSource: 'recommended' }).programId).toBe('full_body')
    expect(buildOnboardingProgram({ ...profile, programId: 'unknown' })).toMatchObject({ status: 'NO_FEASIBLE_PLAN', blockingReasons: [expect.objectContaining({ code: 'INVALID_SPLIT' })] })
  })

  it('blocks a two-day split without trunk work and recommends a complete alternative', () => {
    const profile = { days: 2, goal: 'muscle', experience: 'beginner', equipment: 'full_gym', sessionMinutes: 30, sex: 'male' }
    const selected = buildOnboardingProgram({ ...profile, programId: 'ppl' })
    expect(selected).toMatchObject({ status: 'NO_FEASIBLE_PLAN', programId: 'ppl', selectedSplitSource: 'user' })
    expect(selected.blockingReasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MISSING_MUSCLE_COVERAGE', muscles: ['core'], message: expect.stringContaining('Trunk') }),
    ]))
    expect(selected.routines).toBeUndefined()
    expect(selected.recommendedProgramId).not.toBe('ppl')
    const automatic = buildOnboardingProgram(profile)
    expect(automatic.status).not.toBe('NO_FEASIBLE_PLAN')
    expect(automatic.programId).toBe(automatic.recommendedProgramId)
    expect(automatic.alternatives.some(candidate => candidate.programId === 'ppl')).toBe(false)
    expect(automatic.evidence.weeklyVolume.every(muscle => muscle.total > 0)).toBe(true)
    const state = { bodyweight: [], routines: [], week: {}, customEx: [] }
    expect(applyOnboarding(state, { ...profile, programId: 'ppl' }).status).toBe('NO_FEASIBLE_PLAN')
    expect(state).toEqual({ bodyweight: [], routines: [], week: {}, customEx: [] })
  })

  it('keeps a shortfall as a valid soft tradeoff when every muscle has counted work', () => {
    const plan = buildOnboardingProgram({ days: 2, sessionMinutes: 30, programId: 'full_body', goal: 'muscle', equipment: 'dumbbells', experience: 'advanced' })
    expect(plan.status).toBe('VALID_PLAN_WITH_SOFT_TRADEOFFS')
    expect(plan.evidence.volumeShortfalls.length).toBeGreaterThan(0)
    expect(plan.evidence.weeklyVolume.every(muscle => muscle.total > 0)).toBe(true)
    expect(plan.blockingReasons).toEqual([])
  })

  it('blocks bodyweight plans with no pull station and keeps a complete station-assisted option', () => {
    const profile = { days: 4, goal: 'muscle', experience: 'intermediate', equipment: 'bodyweight', sessionMinutes: 60 }
    const blocked = buildOnboardingProgram(profile)
    expect(blocked.status).toBe('NO_FEASIBLE_PLAN')
    expect(blocked.recommendedProgramId).toBeNull()
    expect(blocked.blockingReasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MISSING_MUSCLE_COVERAGE', muscles: expect.arrayContaining(['back', 'biceps']) }),
    ]))
    const complete = buildOnboardingProgram({ ...profile, hasPullStation: true })
    expect(complete.status).not.toBe('NO_FEASIBLE_PLAN')
    expect(complete.evidence.weeklyVolume.every(muscle => muscle.total > 0)).toBe(true)
  })

  it('does not install an incomplete personalized program or change its existing schedule', () => {
    const profile = { days: 2, goal: 'muscle', experience: 'beginner', equipment: 'full_gym', sessionMinutes: 30, sex: 'male', programId: 'ppl', selectedSplitSource: 'user' }
    const blocked = buildOnboardingProgram(profile)
    const state = { routines: [{ id: 'old' }], week: { 1: 'old' }, dayPlan: { '2099-01-01': 'old' }, customEx: [], onboarding: { completedAt: 1, selectedSplitSource: 'recommended' } }
    const original = structuredClone(state)
    expect(applyPersonalizedProgram(state, blocked)).toBe(false)
    expect(state).toEqual(original)
    const complete = buildOnboardingProgram({ ...profile, programId: 'full_body' })
    expect(applyPersonalizedProgram(state, complete)).toBe(true)
    expect(state.onboarding).toMatchObject({ programId: 'full_body', selectedSplitSource: 'user', trainingAssessment: complete.evidence })
    expect(state.week).toEqual(complete.week)
    expect(state.dayPlan).toEqual({})
    expect(state.routines[0]).toEqual({ id: 'old' })
  })

  it('does not replace invalid explicit days or duration with defaults', () => {
    expect(buildOnboardingProgram({ days: 1 })).toMatchObject({ status: 'NO_FEASIBLE_PLAN', blockingReasons: [expect.objectContaining({ code: 'TRAINING_DAYS' })] })
    expect(buildOnboardingProgram({ days: 3, sessionMinutes: 10 })).toMatchObject({ status: 'NO_FEASIBLE_PLAN', blockingReasons: [expect.objectContaining({ code: 'SESSION_DURATION_LIMIT' })] })
  })

  it('returns structured reasons when every candidate violates a hard requirement', () => {
    const candidates = selectablePrograms().map(programId => ({
      programId, days: 2, week: { 1: programId, 4: programId },
      routines: [{ id: programId, name: 'Pull Day', program: programId, ex: [], estimatedMinutes: 5 }],
      minimumSessionMinutes: { [programId]: Infinity },
      evidence: { sessionMinutes: 30, maxMuscleSessionSets: 10, workloadScore: 0, volumeShortfalls: [], resistanceDays: 2 },
    }))
    const result = selectFeasiblePlan(candidates, { days: 2, programId: 'ppl', equipment: 'bodyweight' })
    expect(result.status).toBe('NO_FEASIBLE_PLAN')
    expect(result.recommendedProgramId).toBeNull()
    expect(result.blockingReasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'NO_SUITABLE_EXERCISE', session: 'Pull Day' }),
      expect.objectContaining({ code: 'MISSING_MUSCLE_COVERAGE', muscles: expect.arrayContaining(['back']) }),
    ]))
    const automatic = selectFeasiblePlan(candidates, { days: 2, equipment: 'bodyweight' })
    expect(automatic.status).toBe('NO_FEASIBLE_PLAN')
    expect(automatic.blockingReasons).toHaveLength(8)
    expect(automatic.blockingReasons.every(reason => reason.split)).toBe(true)
    const state = { bodyweight: [], routines: [], week: {}, customEx: [] }
    const blocked = applyOnboarding(state, { days: 4, programId: 'ppl', equipment: 'bodyweight', sessionMinutes: 30 })
    expect(blocked.status).toBe('NO_FEASIBLE_PLAN')
    expect(state).toEqual({ bodyweight: [], routines: [], week: {}, customEx: [] })
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
              if (plan.status === 'NO_FEASIBLE_PLAN') {
                expect(plan.programId).toBe(programId)
                expect(plan.blockingReasons.length).toBeGreaterThan(0)
                continue
              }
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

  it('keeps three-day strength visits balanced with profile-specific work', () => {
    for (const sex of ['female', 'male', 'unspecified']) for (const sessionMinutes of [60, 75, 90]) {
      const plan = buildOnboardingProgram({ days: 3, programId: 'full_body', goal: 'strength',
        experience: 'intermediate', equipment: 'full_gym', sex, sessionMinutes })
      expect(plan.status).not.toBe('NO_FEASIBLE_PLAN')
      const sessions = lifting(plan)
      const counts = sessions.map(routine => routine.ex.length)
      expect(Math.min(...counts)).toBeGreaterThanOrEqual(6)
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
      for (const routine of sessions) {
        expect(routine.estimatedMinutes).toBeLessThanOrEqual(sessionMinutes)
        expect(new Set(routine.ex.map(entry => entry.id)).size).toBe(routine.ex.length)
      }
      if (sex === 'female') {
        expect(sessions.flatMap(routine => routine.ex).some(entry => entry.movement === 'Hip extension')).toBe(true)
        expect(sessions.flatMap(routine => routine.ex).some(entry => entry.muscles.hamstrings === 1)).toBe(true)
        expect(sessions.flatMap(routine => routine.ex).some(entry => entry.muscles.core === 1)).toBe(true)
      }
      if (sex === 'male') {
        expect(sessions.flatMap(routine => routine.ex).some(entry => entry.movement === 'Vertical pull')).toBe(true)
        expect(sessions.flatMap(routine => routine.ex).some(entry => entry.muscles.shoulders === 1)).toBe(true)
      }
    }
  })

  it('keeps main lift practice in other 60-minute strength splits', () => {
    for (const sex of ['female', 'male', 'unspecified']) {
      for (const [programId, days] of [['upper_lower', 4], ['ppl', 6]]) {
        const plan = buildOnboardingProgram({ days, programId, goal: 'strength',
          experience: 'intermediate', equipment: 'full_gym', sex, sessionMinutes: 60 })
        expect(plan.status).not.toBe('NO_FEASIBLE_PLAN')
        const counts = lifting(plan).map(routine => routine.ex.length)
        expect(Math.min(...counts)).toBeGreaterThanOrEqual(3)
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(3)
        expect(Math.max(...counts)).toBeLessThanOrEqual(7)
        expect(lifting(plan).every(routine => routine.ex.some(entry => entry.mainLift))).toBe(true)
      }
    }
  })

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
    expect(buildOnboardingProgram({ equipment: 'bodyweight', hasPullStation: true }).evidence.bodyweightEquipment).toBe(true)
  })

  it('starts aerobic work gradually, accounts for every scheduled minute and flags limitations', () => {
    const plan = buildOnboardingProgram({ days: 5, goal: 'lose_weight', experience: 'beginner', equipment: 'bodyweight', hasPullStation: true, injuryNote: 'knee pain' })
    expect(plan.evidence).toMatchObject({ resistanceDays: 3, aerobicDays: 2, cardioMinutes: 50, additionalCardioMinutes: 100, needsProfessionalReview: true })
    const cardio = plan.routines.flatMap(r => r.ex).filter(e => e.mode === 'cardio')
    expect(cardio.every(e => e.id === WALKING_EXERCISE.id && e.min === 10)).toBe(true)
    const trained = buildOnboardingProgram({ days: 6, programId: 'ppl', goal: 'lose_weight', experience: 'advanced', equipment: 'full_gym' })
    expect(trained.evidence.cardioMinutes).toBe(90) // Count repeated sessions, not just unique routines.
    expect(trained.evidence.additionalCardioMinutes).toBe(60)
  })

  it('does not infer lifting ability or physique focus from BMI or the body diagram', () => {
    const base = { goal: 'strength', days: 4, experience: 'intermediate', equipment: 'full_gym' }
    for (const sex of ['female', 'male', 'unspecified']) {
      const expected = stripIds(buildOnboardingProgram({ ...base, sex }))
      for (const [currentWeight, height, unit] of [[55, 155, 'kg'], [130, 195, 'kg'], [286.6, 195, 'lb']]) {
        expect(stripIds(buildOnboardingProgram({ ...base, sex, body: 'female', currentWeight, height, unit }))).toEqual(expected)
      }
    }
  })

  it('keeps an existing schedule when sex changes until plan replacement is selected', () => {
    const profile = { goal: 'muscle', currentWeight: 80, height: 175, days: 4, experience: 'intermediate', equipment: 'full_gym', sessionMinutes: 60 }
    const state = { bodyweight: [], routines: [], week: {}, customEx: [], workouts: [{ id: 'completed' }] }
    applyOnboarding(state, { ...profile, sex: 'male' }, 1)
    const originalWeek = { ...state.week }
    const originalRoutineIds = state.routines.map(routine => routine.id)
    applyOnboarding(state, { ...profile, sex: 'female' }, 2, { preservePlan: true })
    expect(state.onboarding.sex).toBe('female')
    expect(state.week).toEqual(originalWeek)
    expect(state.routines.map(routine => routine.id)).toEqual(originalRoutineIds)
    applyOnboarding(state, { ...profile, sex: 'female' }, 3)
    expect(state.onboarding.trainingAssessment.physiqueFocus.id).toBe('feminine')
    expect(state.week).not.toEqual(originalWeek)
    expect(state.workouts).toEqual([{ id: 'completed' }])
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
    expect(state.onboarding).toMatchObject({ completedAt: 123, currentWeight: 82.4, height: 175.5, targetWeight: 75, programId: 'bro_split', selectedSplitSource: 'user', trainingPolicyVersion: TRAINING_POLICY_VERSION, sex: 'unspecified' })
    expect(state.bodyweight).toEqual([{ d: todayISO(), w: 82.4, t: 123 }])
    expect(state.targetW).toBe(75)
    expect(state.body).toBe('female')
    expect(state.workouts).toEqual([{ id: 'completed' }])
    expect(state.routines[0]).toEqual({ id: 'old' })
    expect(Object.keys(state.week)).toHaveLength(3)
    expect(Object.values(state.week).every(id => state.routines.some(r => r.id === id))).toBe(true)
    expect(state.dayPlan).toEqual({})
    expect(state.customEx).toEqual([WALKING_EXERCISE, ...EXTRA_EXERCISES.filter(ex => ex.id === 'og-db-floor-press')])
    expect(state.onboarding.trainingAssessment.weeklyVolume).toHaveLength(10)
    const automaticState = { bodyweight: [], routines: [], week: {}, customEx: [] }
    applyOnboarding(automaticState, { days: 3, goal: 'muscle', equipment: 'full_gym' })
    expect(automaticState.onboarding.selectedSplitSource).toBe('recommended')
  })
})
