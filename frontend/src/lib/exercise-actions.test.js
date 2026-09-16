import { describe, expect, it } from 'vitest'
import { replacementConfig, replaceActiveEntry } from './exercise-actions.js'
import { EXDB } from './exercises.js'
import { supersetUnits } from './history.js'

const lift = EXDB.find(e => e.bp !== 'cardio' && e.eq !== 'body weight').id
const cardio = EXDB.find(e => e.bp === 'cardio').id

describe('exercise replacement', () => {
  it('retains remaining prescription without copying the old exercise load', () => {
    expect(replacementConfig({ id: lift, sets: 4, repsMin: 8, reps: 12, weight: 100, rest: 90 }, lift, 2))
      .toMatchObject({ sets: 2, repsMin: 8, reps: 12, weight: 0, rest: 90 })
    expect(replacementConfig({ id: lift, repsMin: 8, reps: 12 }, cardio)).not.toHaveProperty('repsMin')
  })
  it('keeps logged work on its original exercise and preserves the remaining superset', () => {
    const done = { w: 50, r: 9, done: true }
    const active = { cur: 1, entries: [
      { id: 'a', sg: 'pair', sets: [{ done: false }] },
      { id: 'b', sg: 'pair', target: { reps: 12 }, sets: [done, { done: false }] },
    ] }
    replaceActiveEntry(active, 1, { id: 'c', sets: [{ done: false }] })
    expect(active.entries.map(e => e.id)).toEqual(['b', 'a', 'c'])
    expect(active.entries[0].sets).toEqual([done])
    expect(supersetUnits(active.entries)).toEqual([[0], [1, 2]])
    expect(active.cur).toBe(2)
  })
  it('removes only unfinished work and handles an empty workout', () => {
    const active = { cur: 0, entries: [{ id: 'a', sets: [{ done: true, r: 8 }, { done: false }] }] }
    replaceActiveEntry(active, 0)
    expect(active.entries[0].sets).toEqual([{ done: true, r: 8 }])
    active.entries[0].sets = [{ done: false }]
    replaceActiveEntry(active, 0)
    expect(active).toEqual({ cur: 0, entries: [] })
  })
})
