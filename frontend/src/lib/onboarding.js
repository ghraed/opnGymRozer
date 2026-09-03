import { EXDB, EXIDX } from './exercises.js'
import { buildProgram, programById, PROGRAMS } from './starter.js'
import { todayISO, uid } from './format.js'

export const GOALS = [
  { value: 'muscle', label: 'Build muscle' },
  { value: 'strength', label: 'Build strength' },
  { value: 'lose_weight', label: 'Lose weight' },
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

// Split choice follows available days, not a claim that one split is inherently
// superior. When weekly volume is matched, full-body and split routines perform
// similarly; this rotation keeps major muscle groups recurring through the week.
const PROGRAM_FOR_DAYS = { 2: 'full_body', 3: 'full_body', 4: 'upper_lower', 5: 'upper_lower', 6: 'ppl' }
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

export function selectablePrograms() { return PROGRAMS.map(program => program.id) }

export function recommendationFor(profile = {}) {
  const days = Math.max(2, Math.min(6, Number(profile.days) || 3))
  const goal = profile.goal || 'fitness'
  const recommendedProgramId = programForDays(days)
  const programId = selectablePrograms().includes(profile.programId) ? profile.programId : recommendedProgramId
  const name = programById(programId)?.name || 'Full Body'
  return { days, goal, programId, recommendedProgramId, name, summary: `${days} training days · ${name}` }
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
    next.sets = primary
      ? (experience === 'advanced' ? 4 : experience === 'beginner' ? 2 : 3)
      : (experience === 'advanced' ? 3 : 2)
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
  const maximumExercises = exercisesPerSession(profile.goal)
  return {
    ...routine,
    prog: profile.goal === 'muscle' || profile.goal === 'gain_weight' ? 'double' : 'linear',
    ex: routine.ex.slice(0, maximumExercises).map(entry => substitute(entry, profile.equipment || 'full_gym')).filter(Boolean)
      .map((entry, index) => applyPrescription(entry, profile, index)),
  }
}

function exercisesPerSession(goal) {
  return { strength: 6, lose_weight: 5, fitness: 6, muscle: 8, gain_weight: 8 }[goal] || 6
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

// A chosen split may contain more named workout days than the user's availability (for
// example, a five-part Bro Split on three days). Merge its routines round-robin and take
// the highest-priority movement from each source before adding more work. This preserves
// weekly body-part coverage instead of silently dropping the last routines from the week.
function fitSplitToAvailableDays(routines, profile, recommendation) {
  if (routines.length <= recommendation.days) return routines
  const groups = Array.from({ length: recommendation.days }, () => [])
  routines.forEach((routine, index) => groups[index % groups.length].push(routine))
  const limit = exercisesPerSession(profile.goal)
  const splitName = programById(recommendation.programId)?.name || recommendation.name
  return groups.map((sources, groupIndex) => {
    const selected = [], used = new Set()
    const maximumDepth = Math.max(...sources.map(source => source.ex.length))
    for (let depth = 0; depth < maximumDepth && selected.length < limit; depth++) {
      for (const source of sources) {
        const entry = source.ex[depth]
        if (entry && !used.has(entry.id)) {
          selected.push(entry)
          used.add(entry.id)
        }
        if (selected.length >= limit) break
      }
    }
    return {
      ...sources[0], id: uid(), name: `${splitName} ${groupIndex + 1}`,
      exerciseFilter: undefined, ex: selected,
    }
  })
}

function buildSelectedRoutines(profile, recommendation) {
  let routines
  if (profile.goal === 'strength' && recommendation.programId === 'full_body') {
    const count = recommendation.days === 2 ? 2 : STRENGTH_FULL.length
    routines = STRENGTH_FULL.slice(0, count).map(spec => routineFromSpec(spec, profile, recommendation.programId))
  } else if (profile.goal === 'strength' && recommendation.programId === 'upper_lower') {
    routines = STRENGTH_UPPER_LOWER.map(spec => routineFromSpec(spec, profile, recommendation.programId))
  } else {
    const built = buildProgram(recommendation.programId)
    const count = recommendation.programId === 'full_body' && recommendation.days === 2 ? 2 : built.routines.length
    routines = built.routines.slice(0, count).map(routine => adaptRoutine(routine, profile))
  }
  routines = fitSplitToAvailableDays(routines, profile, recommendation)
  if (profile.goal === 'lose_weight' || profile.goal === 'fitness') {
    const minutes = profile.goal === 'lose_weight' ? 30 : 20
    routines = routines.map((routine, index) => addCardioFinisher(routine, profile, index, minutes))
  }
  return routines
}

/** Build a fresh, equipment-aware plan for an onboarding profile. */
export function buildOnboardingProgram(profile = {}) {
  const recommendation = recommendationFor(profile)
  const routines = buildSelectedRoutines(profile, recommendation)
  const week = {}
  DAYS_FOR_COUNT[recommendation.days].forEach((day, index) => { week[day] = routines[index % routines.length].id })
  const routineById = Object.fromEntries(routines.map(routine => [routine.id, routine]))
  const cardioMinutes = Object.values(week).flatMap(id => routineById[id]?.ex || [])
    .filter(entry => entry.mode === 'cardio').reduce((sum, entry) => sum + (Number(entry.min) || 0), 0)
  const main = routines.flatMap(routine => routine.ex).find(entry => entry.mode !== 'cardio')
  return {
    ...recommendation, routines, week,
    evidence: {
      cardioMinutes,
      additionalCardioMinutes: Math.max(0, 150 - cardioMinutes),
      mainSets: main?.sets || 0,
      mainReps: main?.reps || 0,
      needsProfessionalReview: !!String(profile.injuryNote || '').trim(),
    },
  }
}

/** Apply an onboarding result to a state draft. Workout history is intentionally untouched. */
export function applyOnboarding(state, profile = {}, now = Date.now()) {
  const plan = buildOnboardingProgram(profile)
  const currentWeight = Math.round(Number(profile.currentWeight) * 10) / 10
  const height = Number(profile.height) > 0 ? Math.round(Number(profile.height) * 10) / 10 : null
  const targetWeight = (profile.goal === 'lose_weight' || profile.goal === 'gain_weight') && Number(profile.targetWeight) > 0
    ? Math.round(Number(profile.targetWeight) * 10) / 10 : null
  state.onboarding = { ...profile, currentWeight, height, targetWeight, completedAt: now }
  if (profile.body === 'male' || profile.body === 'female') state.body = profile.body
  const today = todayISO(), entry = state.bodyweight.find(item => item.d === today)
  if (entry) { entry.w = currentWeight; entry.t = now }
  else state.bodyweight.push({ d: today, w: currentWeight, t: now })
  state.bodyweight.sort((a, b) => String(a.d).localeCompare(String(b.d)))
  state.targetW = targetWeight
  state.routines.push(...plan.routines)
  state.week = plan.week
  // Date-specific overrides belong to the schedule they were created against. Keeping an
  // old "rest" or rescheduled routine here can make the freshly applied plan appear missing
  // on Home even though the weekly assignments were saved correctly.
  state.dayPlan = {}
  return plan
}
