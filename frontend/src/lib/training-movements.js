// Explicit movement families replace the old arbitrary catalogue search. Each
// family has a defined training purpose. IDs are app exercise demonstrations;
// source IDs support that purpose/prescription, not approval of each variant.
// See docs/TRAINING_EVIDENCE.md for the rule-to-evidence mapping.
export const EXTRA_EXERCISES = [{
  id: 'og-db-floor-press', n: 'dumbbell floor press', bp: 'chest', tg: 'pectorals', eq: 'dumbbell', custom: true,
  st: ['Lie on the floor with knees bent and a dumbbell in each hand.', 'Keep wrists over elbows and lower with control until the upper arms gently reach the floor.', 'Press upward without bouncing; use a comfortable, controlled load.'],
}]
const family = (label, main, full, dumbbells, bodyweight, novice = []) => ({
  label, main, full, dumbbells, bodyweight, novice,
  sourceIds: ['acsm2026', 'acsm2009', 'iusca2021', 'volume2026', 'mayo'],
})
export const MOVEMENTS = {
  press: family('Horizontal push', true, ['0025', '0047', '0577', '0289', '0314', '0251'], ['0289', '0314', 'og-db-floor-press'], ['3211', '0662', '0493'], ['0577', '0289', '0314']),
  row: family('Horizontal pull', true, ['0027', '1323', '0180', '0293'], ['0293'], ['2300', '0499'], ['0180', '0293']),
  pull: family('Vertical pull', true, ['2330', '0652', '1326'], ['0293'], ['2300', '1326', '0652'], ['2330']),
  squat: family('Squat / knee extension', true, ['0043', '0739', '1760', '0413'], ['1760', '0413'], ['1685'], ['1760', '0739']),
  hinge: family('Hip hinge', true, ['0085', '0032', '0300'], ['0300'], ['3013'], ['0300']),
  singleLeg: family('Single-leg knee / hip extension', true, ['0410', '0413'], ['0410', '0413'], ['3470', '1685'], ['0413']),
  overhead: family('Overhead push', true, ['0426', '0405'], ['0426', '0405'], [], ['0405']),
  chest: family('Chest accessory', false, ['0227', '0308'], ['0308'], ['0662', '3211']),
  sideDelt: family('Shoulder abduction', false, ['0334'], ['0334'], []),
  rearDelt: family('Rear shoulder / upper back', false, ['0383'], ['0383'], ['2300', '0499']),
  biceps: family('Elbow flexion', false, ['0031', '0294', '0313', '0070'], ['0294', '0313'], ['2300', '1326']),
  triceps: family('Elbow extension', false, ['0241', '0194', '0060', '0351'], ['0351', '0259'], ['0259', '1771'], ['0241', '0351']),
  knee: family('Knee extension accessory', false, ['0585'], ['1760', '0413'], ['1685']),
  hamstrings: family('Knee flexion / posterior chain', false, ['0586', '0599'], ['0300'], ['3013']),
  calves: family('Calf raise', false, ['0605', '0594', '1396'], ['0417', '1373'], ['1373']),
  hips: family('Hip accessory', false, ['0598'], ['0413'], ['3013']),
  core: family('Trunk control', false, ['0276', '0175', '0472', '0687'], ['0276'], ['0276'], ['0276']),
  scapula: family('Scapular control', false, ['3021'], ['3021'], ['3021']),
  traps: family('Upper-back accessory', false, ['0095'], ['0383'], ['2300']),
  // Replace upright rows / wrist-only work in these general-purpose starter plans.
  shoulderAccessory: family('Shoulder accessory', false, ['0334', '0383'], ['0334', '0383'], ['3021']),
  forearms: family('Grip / elbow flexion accessory', false, ['0313'], ['0313'], ['2300']),
}

const SOURCE_FAMILY = {}
for (const [key, value] of Object.entries(MOVEMENTS)) {
  for (const id of value.full) SOURCE_FAMILY[id] ??= key
}
Object.assign(SOURCE_FAMILY, { '0120': 'shoulderAccessory', '1411': 'forearms', '1412': 'forearms' })

export const movementFor = id => MOVEMENTS[SOURCE_FAMILY[id]]

// Credit follows the exercise ACTUALLY selected, not the family it substitutes
// for. Direct=1 and indirect=0.5 is the fractional model tested by Pelland et al.
// The classification of each movement is an explicit programming assumption.
const CREDITS = {}
const credit = (ids, muscles, compound = false) => ids.forEach(id => { CREDITS[id] = { muscles, compound } })
credit(['0025', '0047', '0577', '0289', '0314', '0251', '3211', '0662', '0493', 'og-db-floor-press'], { chest: 1, triceps: 0.5, shoulders: 0.5 }, true)
credit(['0027', '1323', '0180', '0293', '2300', '0499'], { back: 1, biceps: 0.5, shoulders: 0.5 }, true)
credit(['2330', '0652', '1326'], { back: 1, biceps: 0.5 }, true)
credit(['0043', '0739', '1760', '0413', '0410', '3470', '1685'], { quads: 1, glutes: 0.5 }, true)
credit(['0085', '0300'], { hamstrings: 1, glutes: 1 }, true)
credit(['0032'], { glutes: 1, hamstrings: 0.5, back: 0.5 }, true)
credit(['3013'], { glutes: 1, hamstrings: 0.5 }, true)
credit(['0426', '0405'], { shoulders: 1, triceps: 0.5 }, true)
credit(['0227', '0308'], { chest: 1 })
credit(['0334'], { shoulders: 1 })
credit(['0383'], { shoulders: 1, back: 0.5 })
credit(['0031', '0294', '0313', '0070'], { biceps: 1 })
credit(['0241', '0194', '0060', '0351', '1771'], { triceps: 1 })
credit(['0259'], { triceps: 1, chest: 0.5, shoulders: 0.5 }, true)
credit(['0585'], { quads: 1 })
credit(['0586', '0599'], { hamstrings: 1 })
credit(['0605', '0594', '1396', '0417', '1373'], { calves: 1 })
credit(['0276', '0175', '0472', '0687'], { core: 1 })
credit(['0095'], { back: 1 })
export const muscleCreditFor = id => CREDITS[id]
const BENCH_IDS = new Set(['0289', '0314', '0308', '0351', '0405', '0410'])
const STATION_IDS = new Set(['2300', '0499', '0652', '1326', '0472', '0251'])
const VARIANT_LABELS = {
  '2300': 'Horizontal pull', '0499': 'Horizontal pull',
  '3211': 'Horizontal push', '0662': 'Horizontal push', '0493': 'Horizontal push',
  'og-db-floor-press': 'Horizontal push', '3013': 'Hip extension',
  '1685': 'Squat / knee extension', '3470': 'Single-leg knee / hip extension',
  '0259': 'Elbow extension', '1771': 'Elbow extension',
  '0417': 'Calf raise', '1373': 'Calf raise',
}

export function selectMovement(entry, profile, used) {
  const movement = movementFor(entry.id)
  if (!movement) return null // Never substitute from an unreviewed catalogue entry.
  const equipment = profile.equipment || 'full_gym'
  const beginner = !profile.experience || profile.experience === 'beginner' || profile.recovery === 'limited'
  let candidates = equipment === 'bodyweight' ? movement.bodyweight
    : equipment === 'dumbbells' ? movement.dumbbells
      : beginner && movement.novice.length ? movement.novice : movement.full
  if (beginner && equipment === 'bodyweight') candidates = candidates.filter(id => !['0652', '1326', '1771'].includes(id))
  if (equipment !== 'full_gym') {
    if (profile.hasBench !== true) candidates = candidates.filter(id => !BENCH_IDS.has(id) && id !== '0493')
    if (profile.hasPullStation !== true) candidates = candidates.filter(id => !STATION_IDS.has(id))
  }
  // Retain a template's variation for experienced clients when it is permitted.
  if (!beginner && candidates.includes(entry.id)) candidates = [entry.id, ...candidates]
  const id = candidates.find(candidate => !used.has(candidate) && CREDITS[candidate])
  if (!id) return null
  const horizontalSubstitute = SOURCE_FAMILY[entry.id] === 'pull' && ['0293', '2300', '0499'].includes(id)
  return { ...entry, id, movement: VARIANT_LABELS[id] || movementFor(id)?.label || movement.label, sourceIds: movement.sourceIds,
    muscles: { ...CREDITS[id].muscles }, mainLift: CREDITS[id].compound, compound: CREDITS[id].compound,
    // A row is a practical dumbbell substitute, not a vertical-pull equivalent.
    adaptation: horizontalSubstitute ? 'Horizontal pulling substitute; add a pulldown or pull-up when equipment and ability allow.' : undefined }
}
