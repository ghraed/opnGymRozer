// Evidence links and the distinction between research findings and product
// assumptions are recorded in docs/TRAINING_EVIDENCE.md. Fractional sets are a
// workload estimate, not a measurement of an individual's muscle stimulus.
// Product requirement: no exercise-specific four-set rule has been adopted.
export const WORKING_SETS = 3

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
  return {
    sessionMinutes, recovery: returning ? 'limited' : 'normal',
    target, targets: Object.fromEntries(Object.keys(MUSCLES).map(m => [m, m === 'core' ? Math.min(6, target) : target])),
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

// Includes a five-minute warm-up, one minute to set up each movement, estimated
// repetition time, and rests BETWEEN sets. Actual session duration will vary.
export function estimateSessionMinutes(routine) {
  let minutes = 5
  for (const entry of routine.ex) {
    if (!(entry.sets > 0)) continue
    if (entry.mode === 'cardio') minutes += entry.min
    else minutes += 1 + entry.sets * entry.reps * 3 / 60 + Math.max(0, entry.sets - 1) * entry.rest / 60
  }
  return Math.round(minutes * 10) / 10
}

export function allocateWeeklySets(routines, week, profile = {}) {
  const limits = trainingConstraints(profile)
  const frequency = Object.fromEntries(routines.map(r => [r.id, Object.values(week).filter(id => id === r.id).length]))
  const resistance = routines.filter(r => r.program !== 'cardio')
  resistance.forEach(r => r.ex.forEach(e => { if (e.mode !== 'cardio') e.sets = 0 }))
  const canSelect = (routine, entry) => {
    if (entry.sets || !frequency[routine.id]) return false
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
  let volume = countWeeklyVolume(routines, week)
  for (;;) {
    let best = null, bestScore = 0
    for (const routine of resistance) for (const entry of routine.ex) {
      if (entry.mode === 'cardio' || !canSelect(routine, entry)) continue
      const occurrences = frequency[routine.id]
      let gain = 0
      for (const [muscle, credit] of Object.entries(entry.muscles)) {
        const deficit = Math.max(0, limits.targets[muscle] - volume[muscle].total)
        gain += Math.min(deficit, WORKING_SETS * credit * occurrences) / limits.targets[muscle]
      }
      if (!coveredMovements.has(entry.movement)) gain += 0.5
      if (!routine.ex.some(e => e.mode !== 'cardio' && e.sets > 0)) gain += 0.5
      const before = estimateSessionMinutes(routine)
      entry.sets = WORKING_SETS
      const cost = Math.max(0.5, estimateSessionMinutes(routine) - before) * occurrences
      entry.sets = 0
      const score = gain / cost
      if (score > bestScore + 1e-9) { best = entry; bestScore = score }
    }
    if (!best) break
    best.sets = WORKING_SETS
    coveredMovements.add(best.movement)
    volume = countWeeklyVolume(routines, week)
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
    workloadScore: weeklyVolume.reduce((sum, m) => sum + m.shortfall / m.target, 0),
  }
}
