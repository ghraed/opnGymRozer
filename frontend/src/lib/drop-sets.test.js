import { describe, it, expect } from 'vitest'
import { addPlannedDrops, buildSets, continuesDrop, saveWorkoutWeight, exLine, setLabel, workoutVolume } from './history.js'
import { applyPrescription, nextPrescription, sessionsFor } from './progression.js'
import { buildPlanBundle, parsePlan, planPrintHTML } from './plan-share.js'
import { EXDB } from './exercises.js'

const id = EXDB.find(e => e.bp !== 'cardio' && e.eq !== 'body weight').id
const cfg = { id, mode: 'reps', sets: 3, reps: 10, weight: 40, setWeights: [40, 35, 30], drops: 2, dropWeights: [20, 15] }
const state = { workouts: [], exWeights: {}, unit: 'kg' }
const build = (S, c) => addPlannedDrops(applyPrescription(buildSets(S, c), nextPrescription(S, c)), c)

describe('drop-set replacement', () => {
  it('shows exactly the configured drop rows without any original sets', () => {
    const before = structuredClone(cfg)
    const sets = build(state, cfg)
    expect(sets).toEqual([
      { w: 20, r: 0, done: false, drop: true },
      { w: 15, r: 0, done: false, drop: true }
    ])
    expect(cfg).toEqual(before)
    expect(continuesDrop(sets, 0)).toBe(true)
    expect(continuesDrop(sets, 1)).toBe(false)
    sets[1].done = true
    expect(continuesDrop(sets, 0)).toBe(false)
  })

  it('restores original sets and weights when the flag is removed, then restores drops when re-enabled', () => {
    const S = { ...state, exWeights: { [id]: { w: 100 } } }
    const c = structuredClone(cfg)
    delete c.drops
    expect(build(S, c).map(s => s.w)).toEqual([40, 35, 30])
    expect(build(S, c).every(s => !s.drop)).toBe(true)
    c.drops = 2
    expect(build(S, c).map(s => s.w)).toEqual([20, 15])
  })

  it('never uses original weights or counts, even with zero weights or a different prescription', () => {
    expect(addPlannedDrops([{ w: 200 }], { ...cfg, sets: 99, weight: 500, dropWeights: [0, 0] }).map(s => s.w)).toEqual([0, 0])
    expect(addPlannedDrops([], { ...cfg, drops: 1 }).map(s => s.w)).toEqual([20])
    expect(addPlannedDrops([], { ...cfg, drops: 3, dropWeights: [20, 15, 10] }).map(s => s.w)).toEqual([20, 15, 10])
    expect(addPlannedDrops([], { ...cfg, drops: 100 })).toHaveLength(3)
    expect(addPlannedDrops([], { ...cfg, dropWeights: undefined }).map(s => s.w)).toEqual([0, 0])
  })

  it('leaves unmarked and non-reps exercise behavior intact', () => {
    const sets = [{ w: 50, r: 10, done: false }]
    expect(addPlannedDrops(sets, { id })).toEqual(sets)
    for (const mode of ['time', 'cardio']) expect(addPlannedDrops(sets, { ...cfg, mode })).toBe(sets)
  })

  it('saves lower drop weights and zero without modifying original weights, including after reload', () => {
    const S = { ...state, routines: [{ id: 'r', ex: [structuredClone(cfg)] }],
      active: { routineId: 'r', entries: [{ id, target: structuredClone(cfg), sets: build(state, cfg) }] } }
    saveWorkoutWeight(S, 0, 0, 12)
    saveWorkoutWeight(S, 0, 1, 0)
    const restored = JSON.parse(JSON.stringify(S))
    const saved = restored.routines[0].ex[0]
    expect(saved.setWeights).toEqual([40, 35, 30])
    expect(saved.weight).toBe(40)
    expect(saved.sets).toBe(3)
    expect(restored.active.entries[0].sets.map(s => s.w)).toEqual([12, 0])
    expect(build(restored, saved).map(s => s.w)).toEqual([12, 0])
    delete saved.drops
    expect(build(restored, saved).map(s => s.w)).toEqual([40, 35, 30])
  })

  it('keeps duplicate exercises and freestyle edits separate', () => {
    const S = { ...state, routines: [{ id: 'r', ex: [structuredClone(cfg), structuredClone(cfg)] }],
      active: { routineId: 'r', entries: [0, 1].map(() => ({ id, target: structuredClone(cfg), sets: build(state, cfg) })) } }
    saveWorkoutWeight(S, 1, 0, 8)
    expect(S.routines[0].ex[0].dropWeights).toEqual([20, 15])
    expect(S.routines[0].ex[1].dropWeights).toEqual([8, 15])
    S.active.routineId = null
    saveWorkoutWeight(S, 0, 0, 6)
    expect(S.active.entries[0].sets[0].w).toBe(6)
    expect(S.routines[0].ex[0].dropWeights).toEqual([20, 15])
    saveWorkoutWeight(S, 0, 0, NaN)
    expect(S.active.entries[0].sets[0].w).toBe(6)
  })

  it('logs drop-only volume and labels without treating it as a failed regular session', () => {
    const sets = build(state, cfg).map(s => ({ ...s, r: 5, done: true }))
    const entry = { id, target: cfg, sets }
    const S = { ...state, workouts: [{ entries: [entry] }] }
    expect(workoutVolume({ entries: [entry] })).toBe(175)
    expect(setLabel(id, sets[0], cfg)).toBe('Drop · 20×5')
    expect(nextPrescription(S, cfg).kind).toBe('off')
    expect(sessionsFor(S, id, cfg)).toEqual([])
    expect(nextPrescription(S, { ...cfg, drops: undefined }).kind).toBe('first')
  })

  it('shares both configurations but displays only the active drop rows', () => {
    const S = { ...state, week: {}, routines: [{ id: 'r', name: 'Test', ex: [cfg] }], customEx: [] }
    const imported = parsePlan(JSON.stringify(buildPlanBundle(S, 'Test'))).routines[0].ex[0]
    expect(imported.setWeights).toEqual([40, 35, 30])
    expect(imported.dropWeights).toEqual([20, 15])
    expect(exLine(imported, 'kg')).toBe('Drop set · 20 / 15 kg')
    expect(planPrintHTML(S, 'Test')).toContain('Drop set · 20 / 15 kg')
    delete imported.drops
    expect(exLine(imported, 'kg')).toContain('40 / 35 / 30 kg')
    expect(build(state, imported)).toHaveLength(3)
  })
})
