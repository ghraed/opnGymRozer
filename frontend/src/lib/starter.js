// Evidence-informed workout templates and the metadata used by the custom builder.
//
// The defaults favour a small number of proven compound movements, then add direct work
// for muscles that compounds can easily under-serve (side/rear delts, arms, calves and
// trunk). Every starter exercise uses 3 working sets. The personalized planner adjusts
// exercise selection and repetitions while preserving that set count.
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
    ['0241', 3, 12], ['0194', 3, 12], ['3021', 3, 12],
  ]],
  pull: ['Pull Day', 'pullup', FILTERS.pull, [
    ['2330', 3, 10], ['0027', 3, 8], ['0383', 3, 12],
    ['0031', 3, 10], ['0313', 3, 12],
  ]],
  legs: ['Leg Day', 'legs', FILTERS.legs, [
    ['0043', 3, 8], ['0085', 3, 10], ['0585', 3, 12], ['0586', 3, 12],
    ['0605', 3, 12], ['0598', 3, 12], ['1396', 3, 15], ['0472', 3, 12],
    ['0687', 3, 12],
  ]],

  upperA: ['Upper A', 'figureStrength', FILTERS.upper, [
    ['0025', 3, 8], ['0027', 3, 8], ['0426', 3, 10], ['2330', 3, 10],
    ['0334', 3, 12], ['0241', 3, 12], ['0031', 3, 12], ['0227', 3, 12],
    ['3021', 3, 12],
  ]],
  upperB: ['Upper B', 'pullup', FILTERS.upper, [
    ['0047', 3, 10], ['0652', 3, 8], ['1323', 3, 10], ['0405', 3, 10],
    ['0383', 3, 12], ['0060', 3, 10], ['0313', 3, 12], ['0308', 3, 12],
  ]],
  lowerA: ['Lower A', 'legs', FILTERS.lower, [
    ['0043', 3, 8], ['0085', 3, 10], ['0585', 3, 12], ['0586', 3, 12],
    ['0605', 3, 12], ['0598', 3, 12], ['0175', 3, 12],
  ]],
  lowerB: ['Lower B', 'legs', FILTERS.lower, [
    ['0032', 3, 6], ['0410', 3, 10], ['0739', 3, 10], ['0586', 3, 12],
    ['0594', 3, 12], ['1396', 3, 15], ['0472', 3, 12], ['0687', 3, 12],
  ]],

  fullA: ['Full Body A', 'figureStrength', FILTERS.full, [
    ['0043', 3, 8], ['0025', 3, 8], ['0027', 3, 8], ['0085', 3, 10],
    ['0334', 3, 12], ['0605', 3, 12], ['3021', 3, 12], ['0472', 3, 12],
  ]],
  fullB: ['Full Body B', 'dumbbell', FILTERS.full, [
    ['0032', 3, 6], ['0047', 3, 10], ['2330', 3, 10], ['0410', 3, 10],
    ['0405', 3, 10], ['0594', 3, 12], ['1396', 3, 15], ['0598', 3, 12],
    ['0175', 3, 12],
  ]],
  fullC: ['Full Body C', 'barbell', FILTERS.full, [
    ['0739', 3, 10], ['0577', 3, 10], ['0652', 3, 8], ['0586', 3, 12],
    ['0383', 3, 12], ['0241', 3, 12], ['0294', 3, 12], ['0605', 3, 12],
    ['0687', 3, 12],
  ]],

  chest: ['Chest Day', 'figureStrength', FILTERS.chest, [
    ['0025', 3, 8], ['0047', 3, 10], ['0251', 3, 10], ['0227', 3, 12],
    ['0241', 3, 12], ['3021', 3, 12], ['0175', 3, 12],
  ]],
  back: ['Back Day', 'pullup', FILTERS.back, [
    ['0032', 3, 6], ['2330', 3, 10], ['0027', 3, 8], ['1323', 3, 10],
    ['0095', 3, 10], ['0383', 3, 12],
  ]],
  shoulders: ['Shoulder Day', 'dumbbell', FILTERS.shoulders, [
    ['0426', 3, 8], ['0334', 3, 12], ['0383', 3, 12], ['0120', 3, 10],
    ['0472', 3, 12],
  ]],
  broLegs: ['Leg Day', 'legs', FILTERS.legs, [
    ['0043', 3, 8], ['0085', 3, 10], ['0739', 3, 10], ['0585', 3, 12],
    ['0586', 3, 12], ['0598', 3, 12], ['0605', 3, 12], ['1396', 3, 15],
  ]],
  arms: ['Arm Day', 'arm', FILTERS.arms, [
    ['0031', 3, 10], ['0060', 3, 10], ['0313', 3, 12], ['0241', 3, 12],
    ['0070', 3, 12], ['0194', 3, 12], ['1411', 3, 15], ['1412', 3, 15],
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
