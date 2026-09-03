import { EXDB, EXIDX } from './exercises.js'
import { buildProgram } from './starter.js'
import { todayISO, uid } from './format.js'

export const GOALS = [
  { value: 'muscle', label: 'Build muscle' },
  { value: 'strength', label: 'Build strength' },
  { value: 'lose_weight', label: 'Lose weight' },
  { value: 'gain_weight', label: 'Gain weight' },
  { value: 'fitness', label: 'General fitness' },
]

export const EXPERIENCES = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

export const EQUIPMENT = [
  { value: 'full_gym', label: 'Full gym' },
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'bodyweight', label: 'Bodyweight only' },
]

const PROGRAM_FOR_DAYS = { 2: 'full_body', 3: 'full_body', 4: 'upper_lower', 5: 'bro_split', 6: 'ppl' }
const DAYS_FOR_COUNT = {
  2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6],
}

// Goal-specific strength templates keep the big, measurable lifts first and use a small
// amount of accessory work after them. Hypertrophy continues to use starter.js's broader
// exercise selection, which gives each muscle more direct weekly volume.
const STRENGTH_FULL = [
  ['Strength A', 'barbell', ['0043', '0025', '0027', '0426', '0652', '0472']],
  ['Strength B', 'dumbbell', ['0032', '0047', '2330', '0739', '0405', '0687']],
  ['Strength C', 'figureStrength', ['0043', '0577', '0027', '0085', '0652', '0472']],
]
const STRENGTH_UPPER_LOWER = [
  ['Upper Strength A', 'barbell', ['0025', '0027', '0426', '0652', '0241', '0294']],
  ['Lower Strength A', 'legs', ['0043', '0085', '0585', '0586', '0605', '0472']],
  ['Upper Strength B', 'dumbbell', ['0047', '2330', '0405', '0577', '0060', '0313']],
  ['Lower Strength B', 'legs', ['0032', '0739', '0410', '0586', '0605', '0687']],
]

const EQUIPMENT_REPLACEMENTS = {
  dumbbells: {
    '0025': '0289', '0047': '0314', '0027': '0293', '0032': '0300', '0043': '1760',
    '0085': '0300', '0577': '0289', '0739': '0413', '2330': '0293', '0605': '0417',
  },
  bodyweight: {
    '0025': '0662', '0047': '0493', '0027': '0499', '0032': '3013', '0043': '3470',
    '0085': '3013', '0426': '0699', '0577': '0662', '0739': '3769', '2330': '1326',
    '0405': '0699', '0585': '3470', '0586': '3193', '0605': '1373', '0241': '0259',
    '0060': '1771', '0294': '0139', '0313': '0139', '0410': '3470',
  },
}

export function programForDays(days) { return PROGRAM_FOR_DAYS[Math.max(2, Math.min(6, Number(days) || 3))] }

export function recommendationFor(profile = {}) {
  const days = Math.max(2, Math.min(6, Number(profile.days) || 3))
  const goal = profile.goal || 'fitness'
  if (goal === 'lose_weight') return { days, programId: 'fat_loss', name: 'Cardio + Full Body', summary: `${days} training days · cardio focused` }
  if (goal === 'fitness') return { days, programId: 'hybrid_fitness', name: 'Strength + Cardio', summary: `${days} training days · balanced fitness` }
  if (goal === 'strength') {
    const programId = days <= 3 ? 'strength_full' : 'strength_upper_lower'
    return { days, programId, name: days <= 3 ? 'Full Body Strength' : 'Upper / Lower Strength', summary: `${days} training days · strength focused` }
  }
  const programId = programForDays(days)
  const baseName = { full_body: 'Full Body', upper_lower: 'Upper / Lower', bro_split: 'Bro Split', ppl: 'Push / Pull / Legs' }[programId]
  const name = `${baseName} Hypertrophy`
  return { days, programId, name, summary: `${days} training days · ${name}` }
}

function equipmentAllows(exercise, equipment) {
  if (equipment === 'full_gym') return true
  if (equipment === 'bodyweight') return exercise.eq === 'body weight'
  return exercise.eq === 'body weight' || exercise.eq === 'dumbbell' || exercise.eq === 'weighted'
}

// Substitute only with a movement for the same primary target/body part. This keeps an
// equipment-constrained plan recognisably equivalent to its full-gym template.
function substitute(entry, equipment) {
  const source = EXIDX[entry.id]
  if (!source || equipmentAllows(source, equipment)) return entry
  const preferred = EQUIPMENT_REPLACEMENTS[equipment]?.[entry.id]
  if (preferred && EXIDX[preferred]) return { ...entry, id: preferred }
  const candidates = EXDB.filter(ex => equipmentAllows(ex, equipment) && ex.bp === source.bp && ex.bp !== 'cardio'
    && !/stretch|yoga|circle|toe touch/i.test(ex.n))
  const replacement = candidates.find(ex => ex.tg === source.tg) || candidates[0]
  return replacement ? { ...entry, id: replacement.id } : null
}

function applyPrescription(entry, profile, index = 0) {
  if (entry.mode === 'cardio') return entry
  const goal = profile.goal || 'fitness'
  const experience = profile.experience || 'beginner'
  const next = { ...entry }
  if (goal === 'strength') {
    const primary = index < 4
    next.sets = primary ? (experience === 'beginner' ? 3 : 4) : (experience === 'advanced' ? 3 : 2)
    next.reps = primary ? 5 : 8
  } else if (goal === 'muscle' || goal === 'gain_weight') {
    const primary = index < 4
    next.sets = experience === 'advanced' ? 4 : experience === 'beginner' ? 2 : 3
    next.reps = primary ? 8 : 12
  } else if (goal === 'lose_weight') {
    next.sets = experience === 'beginner' ? 2 : 3
    next.reps = 10
  } else {
    next.sets = experience === 'beginner' ? 2 : 3
    next.reps = 10
  }
  return next
}

function adaptRoutine(routine, profile) {
  return {
    ...routine,
    ex: routine.ex.map(entry => substitute(entry, profile.equipment || 'full_gym')).filter(Boolean)
      .map((entry, index) => applyPrescription(entry, profile, index)),
  }
}

function routineFromSpec([name, emoji, ids], profile, program) {
  return adaptRoutine({ id: uid(), name, emoji, program, ex: ids.map(id => ({ id, sets: 3, reps: 8, weight: 0 })) }, profile)
}

function cardioExercise(profile, index) {
  const fullGym = ['2138', '2141', '3666']
  const noGym = ['0685', '0630', '1160']
  const choices = profile.equipment === 'full_gym' ? fullGym : noGym
  return choices[index % choices.length]
}

function cardioRoutine(profile, index, minutes) {
  const id = cardioExercise(profile, index)
  const exercise = EXIDX[id]
  return {
    id: uid(), name: index % 2 ? 'Cardio Intervals' : 'Steady Cardio', emoji: index % 2 ? 'timer' : 'heart', program: 'cardio',
    ex: [{ id, sets: 1, mode: 'cardio', min: minutes, speed: id === '0685' ? 8 : 6, weight: 0 }],
    exerciseFilter: { label: 'Cardio', bodyParts: ['cardio'], equipment: exercise?.eq || '' },
  }
}

function addCardioFinisher(routine, profile, index, minutes) {
  return { ...routine, ex: [...routine.ex, cardioRoutine(profile, index, minutes).ex[0]] }
}

function buildStrength(profile, recommendation) {
  const specs = recommendation.days <= 3 ? STRENGTH_FULL.slice(0, recommendation.days) : STRENGTH_UPPER_LOWER
  return specs.map(spec => routineFromSpec(spec, profile, recommendation.programId))
}

function buildHybrid(profile, recommendation, cardioFocused) {
  const days = recommendation.days
  const resistanceCount = cardioFocused ? (days === 6 ? 3 : 2) : (days >= 5 ? 3 : 2)
  let resistance = buildProgram('full_body').routines.slice(0, resistanceCount).map(r => adaptRoutine({ ...r, name: r.name.replace('Full Body', 'Full Body Resistance') }, profile))
  // With only two available days, both sessions combine resistance and aerobic work so the
  // plan still trains every major muscle group twice while making cardio the largest block.
  if (days === 2) return resistance.map((routine, index) => addCardioFinisher(routine, profile, index, cardioFocused ? 30 : 15))
  if (cardioFocused) resistance = resistance.map((routine, index) => addCardioFinisher(routine, profile, index, 20))
  const cardioCount = days - resistance.length
  const cardio = Array.from({ length: cardioCount }, (_, index) => cardioRoutine(profile, index, cardioFocused ? 40 : 25))
  const ordered = []
  while (resistance.length || cardio.length) {
    if (resistance.length) ordered.push(resistance.shift())
    if (cardio.length) ordered.push(cardio.shift())
  }
  return ordered
}

/** Build a fresh, equipment-aware plan for an onboarding profile. */
export function buildOnboardingProgram(profile = {}) {
  const recommendation = recommendationFor(profile)
  let routines
  if (recommendation.programId === 'fat_loss') routines = buildHybrid(profile, recommendation, true)
  else if (recommendation.programId === 'hybrid_fitness') routines = buildHybrid(profile, recommendation, false)
  else if (recommendation.programId.startsWith('strength_')) routines = buildStrength(profile, recommendation)
  else {
    const built = buildProgram(recommendation.programId)
    const routineCount = recommendation.days === 2 ? 2 : built.routines.length
    routines = built.routines.slice(0, routineCount).map(routine => adaptRoutine(routine, profile))
  }
  const week = {}
  DAYS_FOR_COUNT[recommendation.days].forEach((day, index) => { week[day] = routines[index % routines.length].id })
  return { ...recommendation, routines, week }
}

/** Apply an onboarding result to a state draft. Workout history is intentionally untouched. */
export function applyOnboarding(state, profile = {}, now = Date.now()) {
  const plan = buildOnboardingProgram(profile)
  const currentWeight = Math.round(Number(profile.currentWeight) * 10) / 10
  const targetWeight = (profile.goal === 'lose_weight' || profile.goal === 'gain_weight') && Number(profile.targetWeight) > 0
    ? Math.round(Number(profile.targetWeight) * 10) / 10 : null
  state.onboarding = { ...profile, currentWeight, targetWeight, completedAt: now }
  if (profile.body === 'male' || profile.body === 'female') state.body = profile.body
  const today = todayISO(), entry = state.bodyweight.find(item => item.d === today)
  if (entry) { entry.w = currentWeight; entry.t = now }
  else state.bodyweight.push({ d: today, w: currentWeight, t: now })
  state.bodyweight.sort((a, b) => String(a.d).localeCompare(String(b.d)))
  state.targetW = targetWeight
  state.routines.push(...plan.routines)
  state.week = plan.week
  return plan
}
