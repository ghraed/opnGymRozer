import { expect, it } from 'vitest'
import { completedMuscleWork, musclesOf } from './muscles.js'
import { EXDB } from './exercises.js'

it('counts actual completed sets and reps for primary and supporting muscles without counting timed seconds as reps', () => {
  const ex = EXDB.find(e => e.tg === 'pectorals' && Object.keys(musclesOf(e)).length > 1)
  const totals = completedMuscleWork([{ entries: [
    { id: ex.id, sets: [{ done: true, r: 8 }, { done: true, r: 6, drop: true }, { done: false, r: 12 }] },
    { id: ex.id, target: { mode: 'time' }, sets: [{ done: true, sec: 45, r: 99 }] },
    { id: 'missing-id', sets: [{ done: true, r: 10 }] },
  ] }])
  for (const muscle of Object.keys(musclesOf(ex))) expect(totals[muscle]).toEqual({ sets: 3, reps: 14 })
  expect(totals.calves).toEqual({ sets: 0, reps: 0 })
  expect(completedMuscleWork([]).chest).toEqual({ sets: 0, reps: 0 })
})
