import { describe, expect, it } from 'vitest'
import { EXIDX } from './exercises.js'
import { applyOnboarding, buildOnboardingProgram, selectablePrograms, programForDays } from './onboarding.js'
import { todayISO } from './format.js'

describe('onboarding recommendations', () => {
  it('maps every supported training frequency to a valid scheduled program', () => {
    expect(programForDays(2)).toBe('full_body')
    expect(programForDays(3)).toBe('full_body')
    expect(programForDays(4)).toBe('upper_lower')
    expect(programForDays(5)).toBe('upper_lower')
    expect(programForDays(6)).toBe('ppl')
    expect(selectablePrograms()).toEqual(['ppl', 'upper_lower', 'full_body', 'bro_split'])
    for (const goal of ['muscle', 'strength', 'lose_weight', 'gain_weight', 'fitness']) {
      for (let days = 2; days <= 6; days++) {
        const plan = buildOnboardingProgram({ goal, days, equipment: 'full_gym' })
        expect(Object.keys(plan.week), `${goal}: ${days} days`).toHaveLength(days)
        expect(Object.values(plan.week).every(id => plan.routines.some(r => r.id === id))).toBe(true)
        plan.routines.flatMap(r => r.ex).forEach(entry => expect(EXIDX[entry.id]).toBeTruthy())
      }
    }
  })

  it('keeps generated exercises within selected equipment limits', () => {
    for (const equipment of ['bodyweight', 'dumbbells']) {
      for (const goal of ['muscle', 'strength', 'lose_weight', 'gain_weight', 'fitness']) {
        const plan = buildOnboardingProgram({ goal, days: 5, equipment })
        const allowed = ex => equipment === 'bodyweight' ? ex.eq === 'body weight' : ['body weight', 'dumbbell', 'weighted'].includes(ex.eq)
        plan.routines.flatMap(r => r.ex).forEach(entry => expect(allowed(EXIDX[entry.id]), `${goal}: ${EXIDX[entry.id]?.n}`).toBe(true))
      }
    }
  })

  it('uses the intended goal and experience prescriptions', () => {
    const strength = buildOnboardingProgram({ days: 3, goal: 'strength', experience: 'intermediate' })
    expect(strength.routines[0].ex[0]).toMatchObject({ sets: 4, reps: 5 })
    const beginner = buildOnboardingProgram({ days: 3, goal: 'fitness', experience: 'beginner' })
    expect(beginner.routines[0].ex[0]).toMatchObject({ sets: 2, reps: 10 })
    const muscle = buildOnboardingProgram({ days: 3, goal: 'muscle', experience: 'intermediate' })
    expect(muscle.routines[0].ex[0]).toMatchObject({ sets: 3, reps: 8 })
    expect(muscle.programId).toBe(strength.programId)
    expect(muscle.routines[0].name).not.toBe(strength.routines[0].name)
    expect(muscle.routines[0].prog).toBe('double')
    expect(strength.routines[0].prog).toBe('linear')
  })

  it('lets the user override the recommended split and rebuilds exercises for the goal', () => {
    const recommended = buildOnboardingProgram({ days: 5, goal: 'muscle', experience: 'intermediate' })
    expect(recommended).toMatchObject({ programId: 'upper_lower', recommendedProgramId: 'upper_lower', name: 'Upper / Lower' })

    const broMuscle = buildOnboardingProgram({ days: 5, programId: 'bro_split', goal: 'muscle', experience: 'intermediate' })
    const broFatLoss = buildOnboardingProgram({ days: 5, programId: 'bro_split', goal: 'lose_weight', experience: 'beginner' })
    expect(broMuscle).toMatchObject({ programId: 'bro_split', recommendedProgramId: 'upper_lower', name: 'Bro Split' })
    expect(broMuscle.routines).toHaveLength(5)
    expect(Object.keys(broMuscle.week)).toHaveLength(5)
    expect(broMuscle.routines[0].ex.length).toBeGreaterThan(broFatLoss.routines[0].ex.filter(entry => entry.mode !== 'cardio').length)
    expect(broFatLoss.routines[0].ex[0]).toMatchObject({ sets: 2, reps: 10 })

    const adapted = buildOnboardingProgram({ days: 3, programId: 'bro_split', goal: 'muscle' })
    expect(adapted.programId).toBe('bro_split')
    expect(adapted.routines).toHaveLength(3)
    expect(new Set(Object.values(adapted.week))).toEqual(new Set(adapted.routines.map(routine => routine.id)))

    const unknown = buildOnboardingProgram({ days: 3, programId: 'unknown', goal: 'muscle' })
    expect(unknown.programId).toBe('full_body')
  })

  it('supports every split at every training frequency without dropping source coverage', () => {
    for (let days = 2; days <= 6; days++) {
      for (const programId of selectablePrograms()) {
        const plan = buildOnboardingProgram({ days, programId, goal: 'strength', experience: 'intermediate' })
        expect(plan.programId).toBe(programId)
        expect(Object.keys(plan.week)).toHaveLength(days)
        expect(plan.routines.length).toBeLessThanOrEqual(days)
        expect(new Set(Object.values(plan.week))).toEqual(new Set(plan.routines.map(routine => routine.id)))
        plan.routines.forEach(routine => {
          expect(routine.ex.length).toBeGreaterThan(0)
          routine.ex.forEach(entry => expect(entry).toMatchObject({ sets: expect.any(Number), reps: expect.any(Number) }))
        })
      }
    }
  })

  it('makes fat-loss plans cardio focused while retaining resistance days', () => {
    const plan = buildOnboardingProgram({ days: 5, goal: 'lose_weight', experience: 'beginner', equipment: 'full_gym' })
    const cardio = plan.routines.filter(routine => routine.program === 'cardio')
    const resistance = plan.routines.filter(routine => routine.program !== 'cardio')
    expect(cardio).toHaveLength(0)
    expect(resistance).toHaveLength(4)
    resistance.forEach(routine => expect(routine.ex.at(-1)).toMatchObject({ mode: 'cardio', min: 30 }))
    expect(plan.evidence).toMatchObject({ cardioMinutes: 150, additionalCardioMinutes: 0, needsProfessionalReview: false })
  })

  it('exposes honest supporting guidance for lower-frequency and limitation cases', () => {
    const plan = buildOnboardingProgram({ days: 2, goal: 'lose_weight', experience: 'beginner', injuryNote: 'knee pain' })
    expect(plan.evidence).toMatchObject({ cardioMinutes: 60, additionalCardioMinutes: 90, mainSets: 2, needsProfessionalReview: true })
  })

  it('records weights and profile data without touching workout history', () => {
    const state = { body: 'male', bodyweight: [], targetW: null, routines: [], week: {}, dayPlan: { '2099-01-01': 'rest' }, workouts: [{ id: 'completed' }] }
    applyOnboarding(state, { goal: 'lose_weight', currentWeight: 82.4, height: 175.5, targetWeight: 75, days: 3, body: 'female' }, 123)
    expect(state.onboarding).toMatchObject({ completedAt: 123, currentWeight: 82.4, height: 175.5, targetWeight: 75 })
    expect(state.bodyweight).toEqual([{ d: todayISO(), w: 82.4, t: 123 }])
    expect(state.targetW).toBe(75)
    expect(state.body).toBe('female')
    expect(state.workouts).toEqual([{ id: 'completed' }])
    expect(Object.keys(state.week)).toHaveLength(3)
    expect(Object.values(state.week).every(id => state.routines.some(routine => routine.id === id))).toBe(true)
    expect(state.dayPlan).toEqual({})
  })
})
