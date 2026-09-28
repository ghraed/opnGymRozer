import { expect, it } from 'vitest'
import { buildOnboardingProgram } from './onboarding.js'
import { trainingConstraints, countWeeklyVolume } from './training-volume.js'
import { physiqueFocusFor } from './physique-focus.js'

const base = { goal: 'muscle', days: 4, experience: 'intermediate', equipment: 'full_gym', sessionMinutes: 60 }
const entries = plan => plan.routines.flatMap(r => r.ex)

it('applies the selected physique focus to every split, with equipment and workload limits', () => {
  for (const sex of ['female', 'male']) for (const programId of ['full_body', 'upper_lower', 'ppl', 'bro_split']) {
    const plan = buildOnboardingProgram({ ...base, sex, programId })
    expect(plan.evidence.physiqueFocus.id).toBe(sex === 'female' ? 'feminine' : 'v_shape')
    for (const routine of plan.routines) {
      expect(routine.estimatedMinutes).toBeLessThanOrEqual(60)
      for (const volume of Object.values(countWeeklyVolume([routine], { 1: routine.id }))) expect(volume.total).toBeLessThanOrEqual(10)
    }
    expect(entries(plan).filter(e => e.mode !== 'cardio').every(e => e.sets === 3 && e.weight === 0)).toBe(true)
    expect(plan.evidence.missingMuscles).toEqual([])
  }
})

it('selects distinct physique work and keeps balanced primary training', () => {
  const female = buildOnboardingProgram({ ...base, sex: 'female' })
  const male = buildOnboardingProgram({ ...base, sex: 'male' })
  expect(entries(female).some(e => e.movement === 'Hip extension')).toBe(true)
  expect(entries(male).some(e => e.id === '0334')).toBe(true)
  expect(entries(male).some(e => e.movement === 'Vertical pull')).toBe(true)
  const volume = (p, m) => p.evidence.weeklyVolume.find(v => v.muscle === m).total
  expect(volume(female, 'glutes')).toBeGreaterThan(volume(male, 'glutes'))
  expect(volume(male, 'back')).toBeGreaterThan(volume(female, 'back'))
})

it('keeps the same split while making direct focus work distinct in every standard gym split', () => {
  const daysBySplit = { full_body: 3, upper_lower: 4, ppl: 6, bro_split: 5 }
  const direct = (plan, muscle) => plan.evidence.weeklyVolume.find(item => item.muscle === muscle).direct
  for (const [programId, days] of Object.entries(daysBySplit)) {
    const profile = { ...base, programId, days }
    const female = buildOnboardingProgram({ ...profile, sex: 'female' })
    const male = buildOnboardingProgram({ ...profile, sex: 'male' })
    expect(female.status).not.toBe('NO_FEASIBLE_PLAN')
    expect(male.status).not.toBe('NO_FEASIBLE_PLAN')
    expect(female.programId).toBe(male.programId)
    expect(Object.keys(female.week)).toEqual(Object.keys(male.week))
    expect(female.routines.map(r => r.name)).toEqual(male.routines.map(r => r.name))
    expect(direct(female, 'glutes')).toBeGreaterThan(direct(male, 'glutes'))
    expect(direct(female, 'quads') + direct(female, 'hamstrings'))
      .toBeGreaterThanOrEqual(direct(male, 'quads') + direct(male, 'hamstrings'))
    expect(direct(male, 'back')).toBeGreaterThan(direct(female, 'back'))
    expect(direct(male, 'shoulders')).toBeGreaterThan(direct(female, 'shoulders'))
    expect(female.evidence.missingMuscles).toEqual([])
    expect(male.evidence.missingMuscles).toEqual([])
  }
})

it('keeps sex-based emphasis across goals and ranks automatic splits without sex', () => {
  const direct = (plan, muscle) => plan.evidence.weeklyVolume.find(item => item.muscle === muscle).direct
  for (const goal of ['muscle', 'strength', 'lose_weight', 'fitness']) {
    for (const [programId, days] of Object.entries({ full_body: 3, upper_lower: 4, ppl: 6, bro_split: 5 })) {
      const profile = { ...base, goal, programId, days }
      const female = buildOnboardingProgram({ ...profile, sex: 'female' })
      const male = buildOnboardingProgram({ ...profile, sex: 'male' })
      expect(direct(female, 'glutes')).toBeGreaterThan(direct(male, 'glutes'))
      expect(direct(male, 'back') + direct(male, 'shoulders'))
        .toBeGreaterThan(direct(female, 'back') + direct(female, 'shoulders'))
      if (['lose_weight', 'fitness'].includes(goal)) {
        expect(female.evidence.cardioMinutes).toBe(male.evidence.cardioMinutes)
        expect(female.routines.flatMap(routine => routine.ex).filter(entry => entry.mode === 'cardio')
          .every(entry => entry.sets === 1)).toBe(true)
      }
    }
    for (const days of [2, 3, 4, 5, 6]) for (const equipment of ['full_gym', 'dumbbells', 'bodyweight']) {
      const profile = { ...base, goal, days, equipment, programId: null }
      const female = buildOnboardingProgram({ ...profile, sex: 'female' })
      const male = buildOnboardingProgram({ ...profile, sex: 'male' })
      expect(female.programId).toBe(male.programId)
      expect(female.recommendedProgramId).toBe(male.recommendedProgramId)
    }
  }
})

it('reports soft shortfalls in a complete short bodyweight plan', () => {
  for (const sex of ['female', 'male']) {
    const plan = buildOnboardingProgram({ ...base, sex, days: 2, equipment: 'bodyweight', hasPullStation: true, sessionMinutes: 30, recovery: 'limited' })
    expect(plan.status).toBe('VALID_PLAN_WITH_SOFT_TRADEOFFS')
    expect(plan.evidence.volumeShortfalls.length).toBeGreaterThan(0)
    expect(plan.evidence.missingMuscles).toEqual([])
    expect(plan.routines.every(routine => routine.estimatedMinutes <= 30)).toBe(true)
  }
})

it('keeps novice/returner budgets conservative and does not infer sex from the diagram', () => {
  for (const sex of ['female', 'male']) {
    const novice = trainingConstraints({ ...base, sex, experience: 'beginner' })
    const returning = trainingConstraints({ ...base, sex, recovery: 'limited' })
    expect(Math.max(...Object.values(novice.targets))).toBe(6)
    expect(Math.max(...Object.values(returning.targets))).toBe(6)
  }
  expect(physiqueFocusFor({ body: 'female' }).id).toBe('balanced')
  expect(physiqueFocusFor({ sex: 'unspecified', body: 'male' }).id).toBe('balanced')
  const home = buildOnboardingProgram({ ...base, sex: 'female', equipment: 'dumbbells', hasBench: false })
  expect(entries(home).some(e => e.id === 'og-db-glute-bridge')).toBe(true)
  expect(entries(home).some(e => e.id === '1409')).toBe(false)
})

it('keeps short sessions and equipment restrictions for both focuses at every availability', () => {
  for (const sex of ['female', 'male']) for (const days of [2, 3, 4, 5, 6]) {
    for (const equipment of ['full_gym', 'dumbbells', 'bodyweight']) {
      const plan = buildOnboardingProgram({ ...base, sex, days, equipment, hasPullStation: equipment === 'bodyweight', sessionMinutes: 30, recovery: 'limited' })
      expect(plan.status).not.toBe('NO_FEASIBLE_PLAN')
      expect(Object.keys(plan.week)).toHaveLength(days)
      expect(plan.routines.every(r => r.estimatedMinutes <= 30)).toBe(true)
      expect(plan.evidence.physiqueFocus).toEqual(physiqueFocusFor({ sex }))
      expect(plan.evidence.missingMuscles).toEqual([])
      if (equipment === 'bodyweight') {
        expect(entries(plan).some(e => ['1409', 'og-db-glute-bridge', '0334', '2330'].includes(e.id))).toBe(false)
      }
    }
  }
})
