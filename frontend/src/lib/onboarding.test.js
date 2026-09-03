import { describe, expect, it } from 'vitest'
import { EXIDX } from './exercises.js'
import { applyOnboarding, buildOnboardingProgram, programForDays } from './onboarding.js'
import { todayISO } from './format.js'

describe('onboarding recommendations', () => {
  it('maps every supported training frequency to a valid scheduled program', () => {
    expect(programForDays(2)).toBe('full_body')
    expect(programForDays(3)).toBe('full_body')
    expect(programForDays(4)).toBe('upper_lower')
    expect(programForDays(5)).toBe('bro_split')
    expect(programForDays(6)).toBe('ppl')
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
    expect(muscle.programId).not.toBe(strength.programId)
  })

  it('makes fat-loss plans cardio focused while retaining resistance days', () => {
    const plan = buildOnboardingProgram({ days: 5, goal: 'lose_weight', experience: 'beginner', equipment: 'full_gym' })
    const cardio = plan.routines.filter(routine => routine.program === 'cardio')
    const resistance = plan.routines.filter(routine => routine.program !== 'cardio')
    expect(cardio).toHaveLength(3)
    expect(resistance).toHaveLength(2)
    cardio.forEach(routine => expect(routine.ex[0]).toMatchObject({ mode: 'cardio', min: 40 }))
    const weeklyCardioMinutes = plan.routines.flatMap(routine => routine.ex).filter(entry => entry.mode === 'cardio').reduce((sum, entry) => sum + entry.min, 0)
    expect(weeklyCardioMinutes).toBe(160)
  })

  it('records weights and profile data without touching workout history', () => {
    const state = { body: 'male', bodyweight: [], targetW: null, routines: [], week: {}, workouts: [{ id: 'completed' }] }
    applyOnboarding(state, { goal: 'lose_weight', currentWeight: 82.4, targetWeight: 75, days: 3, body: 'female' }, 123)
    expect(state.onboarding).toMatchObject({ completedAt: 123, currentWeight: 82.4, targetWeight: 75 })
    expect(state.bodyweight).toEqual([{ d: todayISO(), w: 82.4, t: 123 }])
    expect(state.targetW).toBe(75)
    expect(state.body).toBe('female')
    expect(state.workouts).toEqual([{ id: 'completed' }])
  })
})
