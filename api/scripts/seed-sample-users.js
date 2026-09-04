import { createPool, hashPassword, migrate } from '../db.js'

// Deliberately opt-in: this creates accounts in the connected database, so it must
// never run as part of migrations or a normal deployment.
if (process.env.SEED_SAMPLE_USERS !== '1') {
  throw new Error('Refusing to seed accounts. Run with SEED_SAMPLE_USERS=1.')
}

const PASSWORD = String(process.env.SEED_PASSWORD || 'SampleGym2026!')
if (PASSWORD.length < 8 || PASSWORD.length > 200) throw new Error('SEED_PASSWORD must be 8–200 characters')

const people = [
  ['Maya Haddad', 'female', 'lose', 74, 66], ['Omar Saad', 'male', 'gain', 68, 75],
  ['Lina Khoury', 'female', 'maintain', 59, 59], ['Karim Nasser', 'male', 'lose', 96, 85],
  ['Nour Salameh', 'female', 'gain', 51, 56], ['Tarek Mansour', 'male', 'maintain', 79, 79],
  ['Yara Fares', 'female', 'lose', 82, 72], ['Jad Rizk', 'male', 'gain', 64, 70],
  ['Rana Daher', 'female', 'maintain', 63, 63], ['Fadi Hobeika', 'male', 'lose', 102, 91],
  ['Sara Ibrahim', 'female', 'gain', 54, 59], ['Ali Hamdan', 'male', 'maintain', 73, 73],
  ['Dima Eid', 'female', 'lose', 70, 63], ['Samir Karam', 'male', 'gain', 71, 78],
  ['Lea Aoun', 'female', 'maintain', 57, 57], ['Hassan Rached', 'male', 'lose', 89, 81],
  ['Mira Tannous', 'female', 'gain', 49, 54], ['Rami Baz', 'male', 'maintain', 84, 84],
  ['Zeina Kanaan', 'female', 'lose', 77, 68], ['Wissam Melki', 'male', 'gain', 66, 73],
  ['Dana Youssef', 'female', 'maintain', 61, 61], ['Nabil Zaatar', 'male', 'lose', 94, 86],
  ['Hala Matar', 'female', 'gain', 53, 58], ['Bassam Assaf', 'male', 'maintain', 76, 76],
  ['Rita Azar', 'female', 'lose', 69, 62], ['Joseph Saba', 'male', 'gain', 69, 76],
  ['Celine Obeid', 'female', 'maintain', 58, 58], ['Marwan Ghanem', 'male', 'lose', 99, 90],
  ['Tala Shami', 'female', 'gain', 55, 60], ['Nadim Farhat', 'male', 'maintain', 81, 81],
]

const fullBody = [
  { id: '0025', sets: 3, reps: 8 }, { id: '2330', sets: 3, reps: 10 },
  { id: '0043', sets: 3, reps: 10 }, { id: '0085', sets: 3, reps: 10 },
  { id: '0426', sets: 2, reps: 12 },
]
const upper = [
  { id: '0025', sets: 3, reps: 8 }, { id: '2330', sets: 3, reps: 10 },
  { id: '0047', sets: 3, reps: 10 }, { id: '0031', sets: 2, reps: 12 },
]
const lower = [
  { id: '0043', sets: 3, reps: 8 }, { id: '0085', sets: 3, reps: 10 },
  { id: '0739', sets: 3, reps: 10 }, { id: '0585', sets: 3, reps: 12 },
]
const push = [
  { id: '0025', sets: 3, reps: 8 }, { id: '0047', sets: 3, reps: 10 }, { id: '0426', sets: 3, reps: 12 },
]
const pull = [
  { id: '2330', sets: 3, reps: 10 }, { id: '0027', sets: 3, reps: 10 }, { id: '0031', sets: 3, reps: 12 },
]
const legs = [
  { id: '0043', sets: 3, reps: 8 }, { id: '0085', sets: 3, reps: 10 }, { id: '0739', sets: 3, reps: 10 },
]
const exerciseBase = { '0025': 45, '2330': 40, '0043': 55, '0085': 45, '0426': 9, '0047': 30, '0031': 20, '0739': 95, '0585': 35, '0027': 38 }

const round = n => Math.round(n * 10) / 10
const iso = date => date.toISOString().slice(0, 10)
const addDays = (date, n) => new Date(date.getTime() + n * 86400000)
const rng = seed => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}

function planFor(index) {
  const id = suffix => `seed-${index}-${suffix}`
  if (index % 3 === 0) {
    const a = { id: id('full-a'), name: 'Full Body A', emoji: 'dumbbell', prog: 'linear', ex: fullBody }
    const b = { id: id('full-b'), name: 'Full Body B', emoji: 'figureStrength', prog: 'linear', ex: fullBody.map((e, i) => ({ ...e, reps: e.reps + (i % 2) })) }
    return { routines: [a, b], week: { 1: a.id, 3: b.id, 5: a.id } }
  }
  if (index % 3 === 1) {
    const u = { id: id('upper'), name: 'Upper', emoji: 'arm', prog: 'linear', ex: upper }
    const l = { id: id('lower'), name: 'Lower', emoji: 'legs', prog: 'linear', ex: lower }
    return { routines: [u, l], week: { 1: u.id, 2: l.id, 4: u.id, 5: l.id } }
  }
  const p = { id: id('push'), name: 'Push', emoji: 'dumbbell', prog: 'linear', ex: push }
  const q = { id: id('pull'), name: 'Pull', emoji: 'pullup', prog: 'linear', ex: pull }
  const l = { id: id('legs'), name: 'Legs', emoji: 'legs', prog: 'linear', ex: legs }
  return { routines: [p, q, l], week: { 1: p.id, 3: q.id, 5: l.id } }
}

function workoutHistory(index, startWeight, targetWeight, plan) {
  const random = rng(1000 + index)
  const today = new Date(); today.setUTCHours(12, 0, 0, 0)
  const start = addDays(today, -70 - (index % 5) * 7)
  const workouts = [], bodyweight = [], exWeights = {}
  let sequence = 0
  for (let day = new Date(start); day <= today; day = addDays(day, 1)) {
    const weeks = Math.max(1, Math.round((today - start) / 604800000))
    const progress = Math.min(1, (day - start) / (weeks * 604800000))
    if (day.getUTCDay() === 1 || day.getUTCDay() === 4) {
      const trend = startWeight + (targetWeight - startWeight) * progress
      bodyweight.push({ d: iso(day), w: round(trend + (random() - .5) * .6), t: day.getTime() + 7 * 3600000 })
    }
    const routineId = plan.week[day.getUTCDay()]
    const routine = plan.routines.find(r => r.id === routineId)
    if (!routine || random() < .18) continue // missed sessions keep the data believable
    const entries = routine.ex.map((config, exIndex) => {
      const base = (exerciseBase[config.id] || 20) * (startWeight > 80 ? 1.12 : startWeight < 60 ? .76 : 1)
      const weight = round(Math.max(2.5, base + progress * (4 + (index % 4) * 1.25)))
      exWeights[config.id] = { w: Math.max(weight, exWeights[config.id]?.w || 0), d: iso(day) }
      return {
        id: config.id,
        topW: weight,
        sets: Array.from({ length: config.sets }, (_, setIndex) => ({
          w: weight, r: Math.max(5, config.reps - (setIndex === config.sets - 1 && random() < .35 ? 1 : 0)), done: true,
          rir: round(Math.max(1, 3 - progress * 1.2 + (random() - .5))),
        })),
      }
    })
    const startMs = day.getTime() + (17 + (index % 3)) * 3600000 + Math.floor(random() * 35) * 60000
    workouts.push({
      id: `seed-workout-${index}-${sequence++}`, d: iso(day), start: startMs, end: startMs + (42 + Math.floor(random() * 28)) * 60000,
      routineId: routine.id, name: routine.name, bw: bodyweight.at(-1)?.w || startWeight, entries,
      vol: Math.round(entries.reduce((total, entry) => total + entry.sets.reduce((sets, set) => sets + set.w * set.r, 0), 0)), prs: [],
    })
  }
  return { workouts, bodyweight, exWeights }
}

const pool = createPool()
await migrate(pool)
const conn = await pool.getConnection()
let created = 0, skipped = 0
try {
  await conn.beginTransaction()
  for (let index = 0; index < people.length; index++) {
    const [name, body, goal, startWeight, targetW] = people[index]
    const email = `sample${String(index + 1).padStart(2, '0')}@seed.opengym.local`
    const [existing] = await conn.execute('SELECT id FROM users WHERE email=? FOR UPDATE', [email])
    if (existing.length) { skipped++; continue }
    const plan = planFor(index)
    const progress = workoutHistory(index, startWeight, targetW, plan)
    const id = `seed-user-${String(index + 1).padStart(2, '0')}`
    const createdAt = addDays(new Date(), -90 - index * 3)
    const settings = {
      unit: 'kg', restSec: 90, sound: true, keepAwake: true, lang: 'en', theme: 'light', accent: ['lime', 'sky', 'violet'][index % 3],
      body, targetW, reminder: { on: false, time: '08:00', tz: null }, effort: 'rir',
      onboarding: { completedAt: createdAt.getTime(), goal, days: Object.keys(plan.week).length, programId: index % 3 === 0 ? 'full_body' : index % 3 === 1 ? 'upper_lower' : 'ppl' },
    }
    const planJson = { routines: plan.routines, week: plan.week, dayPlan: {}, customEx: [] }
    const timestamp = Date.now() - (people.length - index) * 60000
    await conn.execute('INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,\'client\',?)', [id, name, email, hashPassword(PASSWORD), createdAt])
    await conn.execute(`INSERT INTO client_states(user_id,settings_json,plan_json,progress_json,plan_version,progress_version,plan_updated_by,plan_updated_by_role,client_timestamp)
      VALUES (?,?,?,?,1,1,?,'client',?)`, [id, JSON.stringify(settings), JSON.stringify(planJson), JSON.stringify(progress), id, timestamp])
    created++
  }
  await conn.commit()
  console.log(`Sample users ready: ${created} created, ${skipped} already existed.`)
  console.log('Emails: sample01@seed.opengym.local … sample30@seed.opengym.local')
  console.log('Password: use SEED_PASSWORD (default: SampleGym2026!)')
} catch (error) {
  await conn.rollback()
  throw error
} finally {
  conn.release()
  await pool.end()
}
