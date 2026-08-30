export const PLAN_KEYS = ['routines', 'week', 'dayPlan', 'customEx']
export const PROGRESS_KEYS = ['bodyweight', 'workouts', 'exWeights']

const copy = value => JSON.parse(JSON.stringify(value ?? {}))

export function splitState(state = {}) {
  const plan = {}, progress = {}, settings = {}
  for (const [key, value] of Object.entries(state || {})) {
    if (key === 'active' || key === '_ts') continue
    if (PLAN_KEYS.includes(key)) plan[key] = copy(value)
    else if (PROGRESS_KEYS.includes(key)) progress[key] = copy(value)
    else settings[key] = copy(value)
  }
  return { settings, plan, progress, clientTimestamp: Number(state?._ts) || null }
}

export function joinState(row) {
  if (!row) return null
  const settings = parseJson(row.settings_json)
  const plan = parseJson(row.plan_json)
  const progress = parseJson(row.progress_json)
  return { ...settings, ...plan, ...progress, _ts: Number(row.client_timestamp) || Date.now() }
}

export function parseJson(value, fallback = {}) {
  if (value == null) return copy(fallback)
  if (typeof value === 'string') {
    try { return JSON.parse(value) } catch { return copy(fallback) }
  }
  return copy(value)
}

export const sameJson = (a, b) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {})

export function mergeProgress(current = {}, incoming = {}) {
  const merged = { ...copy(current), ...copy(incoming) }
  const workouts = new Map((current.workouts || []).map(w => [w.id, copy(w)]))
  for (const workout of incoming.workouts || []) workouts.set(workout.id, copy(workout))
  merged.workouts = [...workouts.values()].sort((a, b) => String(a.d || '').localeCompare(String(b.d || '')) || (+a.start || 0) - (+b.start || 0))
  const weights = new Map((current.bodyweight || []).map(w => [w.d, copy(w)]))
  for (const weight of incoming.bodyweight || []) weights.set(weight.d, copy(weight))
  merged.bodyweight = [...weights.values()].sort((a, b) => String(a.d || '').localeCompare(String(b.d || '')))
  merged.exWeights = { ...(current.exWeights || {}), ...(incoming.exWeights || {}) }
  return merged
}
