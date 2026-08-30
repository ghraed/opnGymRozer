// Evidence-informed workout templates and the metadata used by the custom builder.
//
// The defaults favour a small number of proven compound movements, then add direct work
// for muscles that compounds can easily under-serve (side/rear delts, arms, calves and
// trunk). Most work uses 3 sets in a moderate rep range; the app's progression rules let
// the user make those prescriptions heavier or lighter later.
import { uid } from './format.js'

const ex = (id, sets = 3, reps = 10) => ({ id, sets, reps, weight: 0 })

const FILTERS = {
  push: { label: 'Push', targets: ['pectorals', 'delts', 'triceps', 'serratus anterior'], bodyParts: ['chest', 'shoulders', 'upper arms'] },
  pull: { label: 'Pull', targets: ['lats', 'upper back', 'traps', 'biceps', 'forearms'], bodyParts: ['back', 'shoulders', 'upper arms', 'lower arms'], nameIncludes: ['rear delt', 'reverse fly', 'face pull'] },
  legs: { label: 'Legs', bodyParts: ['upper legs', 'lower legs'] },
  upper: { label: 'Upper body', bodyParts: ['chest', 'back', 'shoulders', 'upper arms', 'lower arms'] },
  lower: { label: 'Lower body', bodyParts: ['upper legs', 'lower legs', 'waist'] },
  full: { label: 'Full body', bodyParts: ['chest', 'back', 'shoulders', 'upper arms', 'lower arms', 'waist', 'upper legs', 'lower legs'] },
  chest: { label: 'Chest', targets: ['pectorals'], bodyParts: ['chest'] },
  back: { label: 'Back', targets: ['lats', 'upper back', 'traps', 'spine'], bodyParts: ['back'] },
  shoulders: { label: 'Shoulders', bodyParts: ['shoulders'] },
  arms: { label: 'Arms', bodyParts: ['upper arms', 'lower arms'] },
}

// Routine specs: [name, icon, custom-builder filter, [[exercise id, sets, reps], ...]].
// Exercise ids point into exercises-data.js and are deliberately shared between programs
// where the movement serves the same job.
const ROUTINES = {
  push: ['Push Day', 'barbell', FILTERS.push, [
    ['0025', 3, 8], ['0047', 3, 10], ['0426', 3, 8], ['0334', 3, 12],
    ['0241', 3, 12], ['0194', 2, 12], ['3021', 2, 12],
  ]],
  pull: ['Pull Day', 'pullup', FILTERS.pull, [
    ['2330', 3, 10], ['0027', 3, 8], ['0383', 2, 12],
    ['0031', 3, 10], ['0313', 2, 12],
  ]],
  legs: ['Leg Day', 'legs', FILTERS.legs, [
    ['0043', 3, 8], ['0085', 3, 10], ['0585', 2, 12], ['0586', 2, 12],
    ['0605', 3, 12], ['0598', 2, 12], ['1396', 2, 15], ['0472', 2, 12],
    ['0687', 2, 12],
  ]],

  upperA: ['Upper A', 'figureStrength', FILTERS.upper, [
    ['0025', 3, 8], ['0027', 3, 8], ['0426', 3, 10], ['2330', 3, 10],
    ['0334', 2, 12], ['0241', 2, 12], ['0031', 2, 12], ['3021', 2, 12],
  ]],
  upperB: ['Upper B', 'pullup', FILTERS.upper, [
    ['0047', 3, 10], ['0652', 3, 8], ['1323', 3, 10], ['0405', 3, 10],
    ['0383', 2, 12], ['0060', 2, 10], ['0313', 2, 12],
  ]],
  lowerA: ['Lower A', 'legs', FILTERS.lower, [
    ['0043', 3, 8], ['0085', 3, 10], ['0585', 3, 12], ['0586', 3, 12],
    ['0605', 4, 12], ['0598', 2, 12], ['0175', 3, 12],
  ]],
  lowerB: ['Lower B', 'legs', FILTERS.lower, [
    ['0032', 2, 6], ['0410', 3, 10], ['0739', 3, 10], ['0586', 3, 12],
    ['0594', 3, 12], ['1396', 2, 15], ['0472', 2, 12], ['0687', 2, 12],
  ]],

  fullA: ['Full Body A', 'figureStrength', FILTERS.full, [
    ['0043', 3, 8], ['0025', 3, 8], ['0027', 3, 8], ['0085', 3, 10],
    ['0334', 2, 12], ['0605', 3, 12], ['3021', 2, 12], ['0472', 3, 12],
  ]],
  fullB: ['Full Body B', 'dumbbell', FILTERS.full, [
    ['0032', 3, 6], ['0047', 3, 10], ['2330', 3, 10], ['0410', 3, 10],
    ['0405', 2, 10], ['0594', 3, 12], ['1396', 2, 15], ['0598', 2, 12],
    ['0175', 3, 12],
  ]],
  fullC: ['Full Body C', 'barbell', FILTERS.full, [
    ['0739', 3, 10], ['0577', 3, 10], ['0652', 3, 8], ['0586', 3, 12],
    ['0383', 2, 12], ['0241', 2, 12], ['0294', 2, 12], ['0605', 3, 12],
    ['0687', 2, 12],
  ]],

  chest: ['Chest Day', 'figureStrength', FILTERS.chest, [
    ['0025', 4, 8], ['0047', 3, 10], ['0251', 3, 10], ['0227', 3, 12],
    ['0241', 3, 12], ['3021', 2, 12], ['0175', 3, 12],
  ]],
  back: ['Back Day', 'pullup', FILTERS.back, [
    ['0032', 3, 6], ['2330', 3, 10], ['0027', 3, 8], ['1323', 3, 10],
    ['0095', 3, 10], ['0383', 3, 12],
  ]],
  shoulders: ['Shoulder Day', 'dumbbell', FILTERS.shoulders, [
    ['0426', 4, 8], ['0334', 4, 12], ['0383', 4, 12], ['0120', 3, 10],
    ['0472', 3, 12],
  ]],
  broLegs: ['Leg Day', 'legs', FILTERS.legs, [
    ['0043', 4, 8], ['0085', 4, 10], ['0739', 3, 10], ['0585', 3, 12],
    ['0586', 3, 12], ['0598', 3, 12], ['0605', 4, 12], ['1396', 2, 15],
  ]],
  arms: ['Arm Day', 'arm', FILTERS.arms, [
    ['0031', 3, 10], ['0060', 3, 10], ['0313', 3, 12], ['0241', 3, 12],
    ['0070', 3, 12], ['0194', 3, 12], ['1411', 2, 15], ['1412', 2, 15],
  ]],
}

export const PROGRAMS = [
  { id: 'ppl', name: 'Push / Pull / Legs', summary: '6 training days · each muscle group twice weekly', routineKeys: ['push', 'pull', 'legs'], days: { 1: 0, 2: 1, 3: 2, 5: 0, 6: 1, 0: 2 } },
  { id: 'upper_lower', name: 'Upper / Lower', summary: '4 training days · balanced recovery', routineKeys: ['upperA', 'lowerA', 'upperB', 'lowerB'], days: { 1: 0, 2: 1, 4: 2, 5: 3 } },
  { id: 'full_body', name: 'Full Body', summary: '3 training days · full-body coverage each session', routineKeys: ['fullA', 'fullB', 'fullC'], days: { 1: 0, 3: 1, 5: 2 } },
  { id: 'bro_split', name: 'Bro Split', summary: '5 training days · one main body part per day', routineKeys: ['chest', 'back', 'shoulders', 'broLegs', 'arms'], days: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 } },
]

export const programById = id => PROGRAMS.find(p => p.id === id)

const makeRoutine = (key, programId, empty) => {
  const [name, emoji, exerciseFilter, list] = ROUTINES[key]
  return {
    id: uid(), name, emoji, program: programId, exerciseFilter,
    ex: empty ? [] : list.map(([id, sets, reps]) => ex(id, sets, reps)),
  }
}

/** Fresh routines plus a ready-to-apply weekly schedule for one split. */
export function buildProgram(programId, { empty = false } = {}) {
  const program = programById(programId)
  if (!program) throw new Error('Unknown workout program: ' + programId)
  const routines = program.routineKeys.map(key => makeRoutine(key, programId, empty))
  const week = {}
  Object.entries(program.days).forEach(([day, index]) => { week[day] = routines[index].id })
  return { program, routines, week }
}

// Kept for the demo seed and older callers: fresh default PPL routine objects.
export const starterRoutines = () => buildProgram('ppl').routines

/** Whether an exercise belongs in a routine's initial, focused picker view. */
export function exerciseMatchesFilter(exercise, filter) {
  if (!filter || !exercise) return true
  const bp = String(exercise.bp || '').toLowerCase()
  const target = String(exercise.tg || '').toLowerCase()
  const name = String(exercise.n || '').toLowerCase()
  if (Array.isArray(filter.nameIncludes) && filter.nameIncludes.some(term => name.includes(term))) return true
  if (Array.isArray(filter.targets) && filter.targets.length && target) return filter.targets.includes(target)
  return !Array.isArray(filter.bodyParts) || !filter.bodyParts.length || filter.bodyParts.includes(bp)
}
