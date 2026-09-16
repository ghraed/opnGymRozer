import { cleanupSg, defaultConfig, modeOf } from './history.js'

// Keep the prescription, but use the new exercise's own load and logging defaults.
export function replacementConfig(source, id, sets = source.sets) {
  const cfg = { ...defaultConfig(id), id, sets: Math.max(1, sets || 1) }
  if (modeOf(source) === 'time' && modeOf(cfg) !== 'cardio') cfg.mode = 'time'
  if (modeOf(source) === modeOf(cfg)) {
    for (const key of ['reps', 'repsMin', 'sec', 'min', 'rest', 'prog']) {
      if (source[key] != null) cfg[key] = source[key]
    }
  }
  return cfg
}

export function replaceActiveEntry(active, index, replacement = null) {
  const entry = active.entries[index]
  if (!entry) return
  const done = entry.sets.filter(s => s.done)
  let groupStart = index
  while (entry.sg && groupStart > 0 && active.entries[groupStart - 1].sg === entry.sg) groupStart--
  active.entries.splice(index, 1, ...(replacement ? [{ ...replacement, sg: entry.sg }] : []))
  if (done.length) active.entries.splice(groupStart, 0, { ...entry, sg: undefined, sets: done })
  cleanupSg(active.entries)
  active.cur = Math.min(index + (replacement && done.length ? 1 : 0), Math.max(0, active.entries.length - 1))
}

export const replacementFilter = ex => ({
  label: ex.tg || ex.bp,
  targets: ex.tg ? [ex.tg] : [],
  bodyParts: ex.bp ? [ex.bp] : [],
})
