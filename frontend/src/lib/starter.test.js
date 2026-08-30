import { describe, expect, it } from 'vitest'
import { EXIDX } from './exercises.js'
import { loadOf, MUSCLES } from './muscles.js'
import { PROGRAMS, buildProgram, exerciseMatchesFilter } from './starter.js'

describe('workout program templates', () => {
  it('uses real catalogue exercises and schedules only its own routines', () => {
    PROGRAMS.forEach(program => {
      const { routines, week } = buildProgram(program.id)
      const routineIds = new Set(routines.map(r => r.id))
      expect(routines).toHaveLength(program.routineKeys.length)
      expect(Object.keys(week)).toHaveLength(Object.keys(program.days).length)
      expect(Object.values(week).every(id => routineIds.has(id))).toBe(true)
      routines.forEach(routine => {
        expect(routine.ex.length).toBeGreaterThan(0)
        routine.ex.forEach(item => expect(EXIDX[item.id], `${program.id}: ${item.id}`).toBeTruthy())
      })
    })
  })

  it('covers every muscle represented on the app body map over the default week', () => {
    PROGRAMS.forEach(program => {
      const { routines } = buildProgram(program.id)
      const load = loadOf(routines.flatMap(r => r.ex))
      const missed = MUSCLES.filter(muscle => !(load[muscle] > 0))
      expect(missed, program.id).toEqual([])
    })
  })

  it('creates empty but focused routines for the custom path', () => {
    PROGRAMS.forEach(program => {
      const { routines } = buildProgram(program.id, { empty: true })
      routines.forEach(routine => {
        expect(routine.ex).toEqual([])
        expect(routine.exerciseFilter?.label).toBeTruthy()
      })
    })
  })

  it('keeps focused suggestions relevant until the user expands the picker', () => {
    const { routines } = buildProgram('ppl', { empty: true })
    const [push, pull, legs] = routines
    expect(exerciseMatchesFilter(EXIDX['0025'], push.exerciseFilter)).toBe(true)
    expect(exerciseMatchesFilter(EXIDX['0031'], push.exerciseFilter)).toBe(false)
    expect(exerciseMatchesFilter(EXIDX['0383'], pull.exerciseFilter)).toBe(true)
    expect(exerciseMatchesFilter(EXIDX['0043'], legs.exerciseFilter)).toBe(true)
    expect(exerciseMatchesFilter(EXIDX['0025'], legs.exerciseFilter)).toBe(false)
    expect(exerciseMatchesFilter({ n: 'My leg move', bp: 'upper legs', tg: '' }, push.exerciseFilter)).toBe(false)
  })
})
