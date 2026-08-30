import test from 'node:test'
import assert from 'node:assert/strict'
import { joinState, mergeProgress, splitState } from '../state.js'

test('splitState separates plans, progress, settings and removes active workout', () => {
  const source = { unit: 'kg', theme: 'dark', routines: [{ id: 'r1' }], week: { 1: 'r1' }, dayPlan: {}, customEx: [], workouts: [{ id: 'w1' }], bodyweight: [{ d: '2026-01-01', w: 80 }], exWeights: { e1: 10 }, active: { id: 'live' }, _ts: 42 }
  const parts = splitState(source)
  assert.deepEqual(parts.plan.routines, [{ id: 'r1' }])
  assert.deepEqual(parts.progress.workouts, [{ id: 'w1' }])
  assert.equal(parts.settings.unit, 'kg')
  assert.equal(parts.settings.active, undefined)
  assert.equal(parts.clientTimestamp, 42)
})

test('joinState reassembles MySQL JSON columns', () => {
  const state = joinState({ settings_json: { unit: 'lb' }, plan_json: { routines: [] }, progress_json: { workouts: [] }, client_timestamp: 99 })
  assert.deepEqual(state, { unit: 'lb', routines: [], workouts: [], _ts: 99 })
})

test('offline progress merge keeps server and client workouts and latest matching entries', () => {
  const merged = mergeProgress(
    { workouts: [{ id: 'server', d: '2026-01-01' }, { id: 'same', value: 1 }], bodyweight: [{ d: '2026-01-01', w: 80 }], exWeights: { a: 10 } },
    { workouts: [{ id: 'client', d: '2026-01-02' }, { id: 'same', value: 2 }], bodyweight: [{ d: '2026-01-01', w: 79 }], exWeights: { b: 20 } }
  )
  assert.deepEqual(new Set(merged.workouts.map(w => w.id)), new Set(['server', 'client', 'same']))
  assert.equal(merged.workouts.find(w => w.id === 'same').value, 2)
  assert.equal(merged.bodyweight[0].w, 79)
  assert.deepEqual(merged.exWeights, { a: 10, b: 20 })
})
