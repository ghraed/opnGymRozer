import { physiqueFocusFor } from './physique-focus.js'

// Evidence links and the distinction between research findings and product
// assumptions are recorded in docs/TRAINING_EVIDENCE.md. Fractional sets are a
// workload estimate, not a measurement of an individual's muscle stimulus.
// Product requirement: no exercise-specific four-set rule has been adopted.
export const WORKING_SETS = 3

// A soft planning cost for estimated sets beyond a starting target. Squaring
// the relative excess allows useful overlap while making large excess costly.
function overshootPenalty(total, target) {
  const excess = Math.max(0, total - target) / target
  return 2 * excess * excess
}

export const MUSCLES = {
  chest: 'Chest', back: 'Back', quads: 'Quadriceps', hamstrings: 'Hamstrings',
  glutes: 'Glutes', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps',
  calves: 'Calves', core: 'Trunk',
}

export function trainingConstraints(profile = {}) {
  const experience = profile.experience || 'beginner'
  const returning = profile.recovery === 'limited'
  const growth = ['muscle', 'gain_weight'].includes(profile.goal)
  // Starting budgets, not experimentally established cutoffs by experience.
  // ~10 for trained hypertrophy follows ACSM/IUSCA; novices/returners start
  // below that, and strength/general-health goals do not need the same volume.
  let target = growth ? { beginner: 6, intermediate: 10, advanced: 12 }[experience]
    : { beginner: 4, intermediate: 6, advanced: profile.goal === 'strength' ? 8 : 6 }[experience]
  target ||= 4
  if (returning) target = Math.min(target, growth ? 6 : 4)
  const sessionMinutes = [30, 45, 60, 75, 90].includes(Number(profile.sessionMinutes)) ? Number(profile.sessionMinutes) : 60
  const physiqueFocus = physiqueFocusFor(profile)
  const targets = Object.fromEntries(Object.keys(MUSCLES).map(m => [m, m === 'core' ? Math.min(6, target) : target]))
  // One additional three-set block for priority muscles in trained, recovered clients.
  // Novices and returners change emphasis without increasing the starting budget.
  const priorities = Object.fromEntries(Object.keys(MUSCLES).map(m => [m, physiqueFocus.muscles.includes(m) ? 2 : 1]))
  if (!returning && experience !== 'beginner') {
    for (const m of physiqueFocus.muscles) targets[m] += WORKING_SETS
  }
  return {
    physiqueFocus, priorities,
    sessionMinutes, recovery: returning ? 'limited' : 'normal',
    target, targets,
    minExerciseSets: WORKING_SETS, maxExerciseSets: WORKING_SETS,
    maxMuscleSessionSets: 10,
  }
}

export function countWeeklyVolume(routines, week) {
  const result = Object.fromEntries(Object.keys(MUSCLES).map(m => [m, { direct: 0, indirect: 0, total: 0, sessions: 0 }]))
  for (const id of Object.values(week)) {
    const routine = routines.find(r => r.id === id)
    const present = new Set()
    for (const entry of routine?.ex || []) {
      if (entry.mode === 'cardio') continue
      for (const [muscle, credit] of Object.entries(entry.muscles || {})) {
        if (!result[muscle] || !(entry.sets > 0)) continue
        result[muscle][credit === 1 ? 'direct' : 'indirect'] += entry.sets * credit
        present.add(muscle)
      }
    }
    for (const muscle of present) result[muscle].sessions++
  }
  for (const value of Object.values(result)) value.total = value.direct + value.indirect
  return result
}

// Planning estimate: warm-up, variant-specific setup, reps on each side when
// appropriate, side changes, and rests BETWEEN sets. Rest is not doubled for
// unilateral work because the sides are completed within each prescribed set.
export function estimateSessionMinutes(routine) {
  let minutes = 5
  for (const entry of routine.ex) {
    if (!(entry.sets > 0)) continue
    if (entry.mode === 'cardio') minutes += entry.min
    else {
      const setupMinutes = { low: 0.5, medium: 1, high: 2 }[entry.setupCost] ?? 1
      const sides = entry.executionMode === 'unilateral' ? 2 : 1
      const workSeconds = entry.sets * (entry.reps * sides * 3 + (sides - 1) * 20)
      minutes += setupMinutes + workSeconds / 60 + Math.max(0, entry.sets - 1) * entry.rest / 60
    }
  }
  return Math.ceil(minutes * 10 - 1e-9) / 10
}

export function allocateWeeklySets(routines, week, profile = {}) {
  const limits = trainingConstraints(profile)
  const frequency = Object.fromEntries(routines.map(r => [r.id, Object.values(week).filter(id => id === r.id).length]))
  const resistance = routines.filter(r => r.program !== 'cardio')
  const balancedStrength = profile.goal === 'strength' && resistance.length > 1
  const strengthExerciseLimit = resistance.every(routine => routine.program === 'ppl') ? 6 : 7
  const exerciseCount = routine => routine.ex.filter(entry => entry.mode !== 'cardio' && entry.sets > 0).length
  resistance.forEach(r => r.ex.forEach(e => { if (e.mode !== 'cardio') e.sets = 0 }))
  const canSelect = (routine, entry) => {
    if (entry.sets || !frequency[routine.id] || (balancedStrength && exerciseCount(routine) >= strengthExerciseLimit)) return false
    entry.sets = WORKING_SETS
    const timeFits = estimateSessionMinutes(routine) <= limits.sessionMinutes
    const muscleFits = Object.keys(entry.muscles).every(m => routine.ex.reduce((sum, e) => sum + (e.muscles?.[m] || 0) * e.sets, 0) <= limits.maxMuscleSessionSets)
    entry.sets = 0
    return timeFits && muscleFits
  }
  // Select complete three-set exercises. Adjust exercise selection to the weekly
  // workload and available time; never shave sets off an included exercise.
  // Distinct movement patterns get a preference even when broad muscle totals
  // overlap (for example, lateral raises versus overhead pressing).
  const coveredMovements = new Set()
  const directlyFocused = entry => limits.physiqueFocus.muscles.some(muscle => entry.muscles?.[muscle] === 1)
  let volume = countWeeklyVolume(routines, week)
  const candidateScore = (routine, entry, baseGain = 0) => {
    const occurrences = frequency[routine.id]
    let gain = baseGain, excessCost = 0
    for (const [muscle, credit] of Object.entries(entry.muscles)) {
      const current = volume[muscle].total
      const added = WORKING_SETS * credit * occurrences
      gain += Math.min(Math.max(0, limits.targets[muscle] - current), added) / limits.targets[muscle] * limits.priorities[muscle]
      excessCost += overshootPenalty(current + added, limits.targets[muscle]) - overshootPenalty(current, limits.targets[muscle])
    }
    if (!coveredMovements.has(entry.movement)) gain += 0.5
    if (!routine.ex.some(e => e.mode !== 'cardio' && e.sets > 0)) gain += 0.5
    const before = estimateSessionMinutes(routine)
    entry.sets = WORKING_SETS
    const cost = Math.max(0.5, estimateSessionMinutes(routine) - before) * occurrences
    entry.sets = 0
    return (gain - excessCost) / cost
  }
  // Protect at most one focus compound and one distinct accessory across the
  // actual week. Both must earn a positive score after their full weekly overlap.
  if (limits.physiqueFocus.muscles.length) {
    const reserve = mainLift => {
      let best = null, bestScore = 0, bestPreference = -1
      for (const routine of resistance) for (const entry of routine.ex) {
        if (entry.mainLift !== mainLift || !directlyFocused(entry) || !canSelect(routine, entry)) continue
        const score = candidateScore(routine, entry)
        const preferredAccessory = limits.physiqueFocus.id === 'feminine' ? 'Hip extension'
          : ['Pull', 'Back'].includes(routine.exerciseFilter?.label) ? 'Upper-back accessory' : 'Rear shoulder / upper back'
        const preference = mainLift ? Number(limits.physiqueFocus.id === 'feminine' && entry.muscles?.glutes === 1)
          : Number(entry.movement === preferredAccessory)
        if (score > 0 && (preference > bestPreference || (preference === bestPreference && score > bestScore + 1e-9))) {
          best = entry; bestScore = score; bestPreference = preference
        }
      }
      if (best) {
        best.sets = WORKING_SETS
        coveredMovements.add(best.movement)
        volume = countWeeklyVolume(routines, week)
      }
    }
    reserve(true)
    reserve(false)
  }
  for (;;) {
    let best = null, bestScore = 0
    // Fill the shortest strength session with a beneficial option first. A
    // feasible but non-beneficial option must not block other sessions.
    const candidates = []
    for (const routine of resistance) for (const entry of routine.ex) {
      if (entry.mode === 'cardio' || !canSelect(routine, entry)) continue
      // Strength practice has value beyond the estimated muscle set target.
      const score = candidateScore(routine, entry, balancedStrength ? 3 : 0)
      if (score > 0) candidates.push({ routine, entry, score })
    }
    const shortest = balancedStrength && candidates.length ? Math.min(...candidates.map(({ routine }) => exerciseCount(routine))) : 0
    for (const candidate of candidates) {
      if (balancedStrength && exerciseCount(candidate.routine) !== shortest) continue
      if (candidate.score > bestScore + 1e-9) { best = candidate.entry; bestScore = candidate.score }
    }
    if (!best) break
    best.sets = WORKING_SETS
    coveredMovements.add(best.movement)
    volume = countWeeklyVolume(routines, week)
  }
  // A focus reservation can make the last slot scarce. If a muscle would have
  // no work at all, swap a redundant resistance exercise for suitable direct
  // work while retaining every muscle group already covered.
  for (const muscle of Object.keys(MUSCLES)) {
    if (volume[muscle].total > 0) continue
    let repaired = false
    for (const routine of resistance) {
      if (repaired) break
      for (const candidate of routine.ex.filter(entry => !entry.sets && entry.muscles?.[muscle] === 1)) {
        const replaceable = routine.ex.filter(entry => entry.mode !== 'cardio' && entry.sets)
          .sort((a, b) => Number(directlyFocused(a)) - Number(directlyFocused(b)) || Number(a.mainLift) - Number(b.mainLift))
        for (const replaced of replaceable) {
          replaced.sets = 0
          const without = countWeeklyVolume(routines, week)
          if (Object.keys(MUSCLES).every(key => volume[key].total === 0 || without[key].total > 0) && canSelect(routine, candidate)) {
            candidate.sets = WORKING_SETS
            volume = countWeeklyVolume(routines, week)
            repaired = true
            break
          }
          replaced.sets = WORKING_SETS
        }
        if (repaired) break
      }
    }
  }
  for (const routine of routines) {
    routine.ex = routine.ex.filter(e => e.sets > 0)
    routine.estimatedMinutes = estimateSessionMinutes(routine)
    for (const entry of routine.ex.filter(e => e.mode !== 'cardio')) {
      entry.weeklyOccurrences = frequency[routine.id]
      entry.weeklySets = entry.sets * frequency[routine.id]
      entry.volumeReason = Object.keys(entry.muscles).filter(m => entry.muscles[m] === 1)
        .map(m => ({ muscle: m, direct: volume[m].direct, indirect: volume[m].indirect, total: volume[m].total, target: limits.targets[m] }))
    }
  }
  const weeklyVolume = Object.entries(volume).map(([muscle, values]) => ({ muscle, label: MUSCLES[muscle], ...values,
    target: limits.targets[muscle], shortfall: Math.max(0, limits.targets[muscle] - values.total) }))
  return { ...limits, weeklyVolume,
    volumeShortfalls: weeklyVolume.filter(m => m.shortfall > 0),
    missingMuscles: weeklyVolume.filter(m => m.total === 0).map(m => m.label),
    workloadScore: weeklyVolume.reduce((sum, m) => sum + m.shortfall / m.target * limits.priorities[m.muscle], 0),
    overshootScore: weeklyVolume.reduce((sum, m) => sum + overshootPenalty(m.total, m.target), 0),
  }
}
