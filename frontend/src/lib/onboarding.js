import { buildProgram, programById, PROGRAMS } from './starter.js'
import { todayISO, uid } from './format.js'
import { movementFor, selectMovement, EXTRA_EXERCISES } from './training-movements.js'
import { TRAINING_POLICY_VERSION, TRAINING_SOURCES } from './training-evidence.js'
import { allocateWeeklySets, trainingConstraints } from './training-volume.js'
import { EXIDX } from './exercises.js'

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
const normalizedDays = days => Math.max(2, Math.min(6, Math.round(Number(days) || 3)))
const DAYS_FOR_COUNT = {
  2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6],
}

// Goal-specific strength templates keep the big, measurable lifts first and use a small
// amount of accessory work after them. Hypertrophy continues to use starter.js's broader
// exercise selection, which gives each muscle more direct weekly volume.
const STRENGTH_FULL = [
  ['Strength A', 'barbell', ['0043', '0025', '0027', '0426', '0652', '0605', '0472']],
  ['Strength B', 'dumbbell', ['0032', '0047', '2330', '0739', '0405', '0594', '0687']],
  ['Strength C', 'figureStrength', ['0043', '0577', '0027', '0085', '0652', '0605', '0472']],
]
const STRENGTH_UPPER_LOWER = [
  ['Upper Strength A', 'barbell', ['0025', '0027', '0426', '0652', '0241', '0294']],
  ['Lower Strength A', 'legs', ['0043', '0085', '0585', '0586', '0605', '0472']],
  ['Upper Strength B', 'dumbbell', ['0047', '2330', '0405', '0577', '0060', '0313']],
  ['Lower Strength B', 'legs', ['0032', '0739', '0410', '0586', '0605', '0687']],
]

export function isMainLift(id) { return !!movementFor(id)?.main }

export function programForDays(days) { return PROGRAM_FOR_DAYS[normalizedDays(days)] }

export function selectablePrograms() { return PROGRAMS.map(program => program.id) }

function preferredProgram(profile, days) {
  if (!profile.experience || profile.experience === 'beginner' || profile.recovery === 'limited') return 'full_body'
  return days === 6 && !['strength', 'muscle', 'gain_weight'].includes(profile.goal) ? 'upper_lower' : programForDays(days)
}

function applyPrescription(entry, profile) {
  const beginner = !profile.experience || profile.experience === 'beginner' || profile.recovery === 'limited'
  const equipment = EXIDX[entry.id]?.eq || EXTRA_EXERCISES.find(ex => ex.id === entry.id)?.eq
  const heavy = profile.goal === 'strength' && !beginner && entry.compound && equipment !== 'body weight'
  const growth = ['muscle', 'gain_weight'].includes(profile.goal)
  const smallShoulder = ['0334', '0383'].includes(entry.id)
  const range = heavy ? [4, 6] : beginner ? [8, 12]
    : growth ? (entry.compound ? [6, 12] : smallShoulder ? [12, 20] : [10, 15]) : [8, 15]
  return { ...entry, sets: 0, weight: 0, heavy, repsMin: range[0], reps: range[1],
    rest: heavy ? 180 : entry.compound ? 120 : 90,
    effort: { minRir: beginner ? 3 : 2, maxRir: beginner ? 4 : 3 },
    prescriptionSourceIds: ['acsm2026', 'iusca2021', 'rest2024'],
  }
}

function adaptRoutine(routine, profile) {
  const used = new Set()
  return {
    ...routine,
    prog: profile.goal === 'muscle' || profile.goal === 'gain_weight' ? 'double' : 'linear',
    ex: routine.ex.map(entry => {
      const replacement = selectMovement(entry, profile, used)
      if (!replacement) return null
      used.add(replacement.id)
      return replacement
    }).filter(Boolean).sort((a, b) => Number(b.mainLift) - Number(a.mainLift))
      .map(entry => applyPrescription(entry, profile)),
  }
}

function routineFromSpec([name, emoji, ids], profile, program) {
  return adaptRoutine({ id: uid(), name, emoji, program, ex: ids.map(id => ({ id, sets: 3, reps: 8, weight: 0 })) }, profile)
}

export const WALKING_EXERCISE = {
  id: 'og-moderate-walk', n: 'walking at a comfortable moderate pace', bp: 'cardio',
  tg: 'cardiovascular system', eq: 'body weight', custom: true,
  st: ['Start at a comfortable pace on a level route.', 'Build toward a pace that lets you talk but not sing. Shorter bouts are fine.'],
}

function cardioRoutine(profile, index, minutes) {
  const id = profile.equipment === 'full_gym' ? (index % 2 ? '2141' : '2138') : WALKING_EXERCISE.id
  return {
    id: uid(), name: 'Moderate Cardio', emoji: 'heart', program: 'cardio',
    ex: [{ id, sets: 1, mode: 'cardio', min: minutes, speed: 0, weight: 0, sourceIds: ['niddk'], movement: 'Moderate aerobic activity' }],
    exerciseFilter: { label: 'Cardio', bodyParts: ['cardio'] },
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
  const splitName = programById(recommendation.programId)?.name || recommendation.name
  return groups.map((sources, groupIndex) => {
    const selected = [], used = new Set()
    const maximumDepth = Math.max(...sources.map(source => source.ex.length))
    for (let depth = 0; depth < maximumDepth; depth++) {
      for (const source of sources) {
        const entry = source.ex[depth]
        if (entry && !used.has(entry.id)) {
          selected.push(entry)
          used.add(entry.id)
        }
      }
    }
    return {
      ...sources[0], id: uid(), name: `${splitName} ${groupIndex + 1}`,
      exerciseFilter: undefined, ex: selected.sort((a, b) => Number(b.compound) - Number(a.compound)),
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
    const desiredMinutes = !profile.experience || profile.experience === 'beginner' || profile.recovery === 'limited' ? 10 : profile.goal === 'lose_weight' ? 30 : 20
    const minutes = Math.min(desiredMinutes, Math.floor(trainingConstraints(profile).sessionMinutes / 4))
    routines = routines.map((routine, index) => addCardioFinisher(routine, profile, index, minutes))
  }
  return routines
}

/** Build a fresh, equipment-aware plan for an onboarding profile. */
function buildCandidate(profile, programId) {
  const days = normalizedDays(profile.days)
  const name = programById(programId).name
  const recommendation = { days, goal: profile.goal || 'fitness', programId, name, summary: `${days} training days · ${name}` }
  const routines = buildSelectedRoutines(profile, recommendation)
  const week = {}
  // Full-body sessions need intervening recovery days. Upper/lower has four
  // resistance sessions; additional available days are moderate aerobic work.
  // PPL repeats only when six days are available, keeping all three days balanced.
  const resistanceDays = recommendation.programId === 'full_body' ? Math.min(3, recommendation.days)
    : recommendation.programId === 'upper_lower' ? Math.min(4, recommendation.days)
      : recommendation.programId === 'ppl' ? (recommendation.days === 6 ? 6 : Math.min(3, recommendation.days))
        : Math.min(5, recommendation.days)
  const liftingDays = DAYS_FOR_COUNT[resistanceDays]
  liftingDays.forEach((day, index) => { week[day] = routines[index % routines.length].id })
  const minutes = !profile.experience || profile.experience === 'beginner' || profile.recovery === 'limited' ? 10 : Math.min(30, trainingConstraints(profile).sessionMinutes - 5)
  for (const day of [2, 4, 6, 1, 3, 5, 0]) {
    if (Object.keys(week).length >= recommendation.days) break
    if (week[day]) continue
    const cardio = cardioRoutine(profile, day, minutes)
    routines.push(cardio)
    week[day] = cardio.id
  }
  const workload = allocateWeeklySets(routines, week, profile)
  const routineById = Object.fromEntries(routines.map(routine => [routine.id, routine]))
  const cardioMinutes = Object.values(week).flatMap(id => routineById[id]?.ex || [])
    .filter(entry => entry.mode === 'cardio').reduce((sum, entry) => sum + (Number(entry.min) || 0), 0)
  const main = routines.flatMap(routine => routine.ex).find(entry => entry.mode !== 'cardio')
  return {
    ...recommendation, routines, week,
    customEx: [WALKING_EXERCISE, ...EXTRA_EXERCISES].filter(ex => routines.some(r => r.ex.some(e => e.id === ex.id))),
    evidence: {
      ...workload,
      unavailableSessions: routines.filter(r => !r.ex.length).map(r => r.name),
      profileFactors: {
        goal: profile.goal || 'fitness', days, experience: profile.experience || 'beginner',
        equipment: profile.equipment || 'full_gym', sessionMinutes: workload.sessionMinutes, recovery: workload.recovery,
        weight: Number(profile.currentWeight) || null, height: Number(profile.height) || null, unit: profile.unit || 'kg',
        hasBench: profile.hasBench === true, hasPullStation: profile.hasPullStation === true,
        sex: profile.sex || null,
      },
      policyVersion: TRAINING_POLICY_VERSION,
      sourceIds: TRAINING_SOURCES.map(source => source.id),
      resistanceDays,
      aerobicDays: recommendation.days - resistanceDays,
      combinedSplit: recommendation.programId !== 'full_body' && programById(recommendation.programId).routineKeys.length > recommendation.days,
      lowFrequencySplit: ['bro_split', 'ppl'].includes(recommendation.programId) && resistanceDays < 6,
      bodyweightEquipment: profile.equipment === 'bodyweight',
      dumbbellEquipment: profile.equipment === 'dumbbells',
      cardioMinutes,
      additionalCardioMinutes: Math.max(0, 150 - cardioMinutes),
      mainSets: main?.sets || 0,
      mainReps: main?.reps || 0,
      needsProfessionalReview: !!String(profile.injuryNote || '').trim(),
    },
  }
}

/** Compare feasible weekly workloads for all four splits before selecting one.
 * This is a transparent scheduling heuristic, not a clinically validated score. */
export function buildOnboardingProgram(profile = {}) {
  const candidates = selectablePrograms().map(id => buildCandidate(profile, id))
  const preferred = preferredProgram(profile, normalizedDays(profile.days))
  const novice = !profile.experience || profile.experience === 'beginner' || profile.recovery === 'limited'
  const scores = candidates.map(plan => ({
    programId: plan.programId,
    score: plan.evidence.workloadScore + plan.evidence.unavailableSessions.length * 2
      + (plan.programId === preferred ? 0 : 0.4)
      + (novice && plan.evidence.resistanceDays > 3 ? 1.5 : 0),
    shortfall: plan.evidence.workloadScore,
  })).sort((a, b) => a.score - b.score)
  const recommendedProgramId = scores[0].programId
  const programId = selectablePrograms().includes(profile.programId) ? profile.programId : recommendedProgramId
  return { ...candidates.find(plan => plan.programId === programId), recommendedProgramId, alternatives: scores }
}

export function recommendationFor(profile = {}) {
  const { days, goal, programId, recommendedProgramId, name, summary } = buildOnboardingProgram(profile)
  return { days, goal, programId, recommendedProgramId, name, summary }
}

/** Apply an onboarding result to a state draft. Workout history is intentionally untouched. */
export function applyOnboarding(state, profile = {}, now = Date.now(), { preservePlan = false } = {}) {
  const previousAssessment = state.onboarding?.trainingAssessment
  const plan = buildOnboardingProgram({ ...profile, unit: state.unit || profile.unit || 'kg' })
  const currentWeight = Math.round(Number(profile.currentWeight) * 10) / 10
  const height = Number(profile.height) > 0 ? Math.round(Number(profile.height) * 10) / 10 : null
  const targetWeight = (profile.goal === 'lose_weight' || profile.goal === 'gain_weight') && Number(profile.targetWeight) > 0
    ? Math.round(Number(profile.targetWeight) * 10) / 10 : null
  // Persist the resolved recommendation as the selected program. Fresh onboarding profiles
  // intentionally omit programId until the user either accepts the recommendation or chooses
  // another split.
  state.onboarding = { ...profile, programId: preservePlan ? state.onboarding?.programId || null : plan.programId, currentWeight, height, targetWeight, completedAt: now, trainingPolicyVersion: preservePlan ? state.onboarding?.trainingPolicyVersion || null : TRAINING_POLICY_VERSION }
  if (!preservePlan) state.onboarding.trainingAssessment = plan.evidence
  else if (previousAssessment) state.onboarding.trainingAssessment = previousAssessment
  if (profile.body === 'male' || profile.body === 'female') state.body = profile.body
  const today = todayISO(), entry = state.bodyweight.find(item => item.d === today)
  if (entry) { entry.w = currentWeight; entry.t = now }
  else state.bodyweight.push({ d: today, w: currentWeight, t: now })
  state.bodyweight.sort((a, b) => String(a.d).localeCompare(String(b.d)))
  state.targetW = targetWeight
  if (!preservePlan) {
    state.customEx ||= []
    for (const exercise of plan.customEx) {
      if (!state.customEx.some(existing => existing.id === exercise.id)) state.customEx.push({ ...exercise })
    }
    state.routines.push(...plan.routines)
    state.week = plan.week
    // Date-specific overrides belong to the schedule they were created against. Keeping an
    // old "rest" or rescheduled routine here can make the freshly applied plan appear missing
    // on Home even though the weekly assignments were saved correctly.
    state.dayPlan = {}
  }
  return plan
}
