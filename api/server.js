import http from 'node:http'
import crypto from 'node:crypto'
import webpush from 'web-push'
import { createPool, createPasswordUser, getUser, getUserByEmail, hashPassword, migrate, readClientState, saveClientState, saveTrainerPlan, setting } from './db.js'
import { parseJson } from './state.js'

const PORT = +(process.env.PORT || 3000)
const ORIGIN = process.env.ORIGIN || 'http://localhost:8080'
const INVITE_ONLY = /^(1|true|yes|on)$/i.test(process.env.INVITE_ONLY || '')
const SESSION_DAYS = Math.max(1, +(process.env.SESSION_DAYS || 90) || 90), MAX_BODY = 5 * 1024 * 1024
const SECURE = /^https:/i.test(ORIGIN) ? ' Secure;' : ''
const pool = createPool()
await migrate(pool)
const SECRET = process.env.SESSION_SECRET || await setting(pool, 'session_secret', () => crypto.randomBytes(32).toString('hex'))
const vapid = await setting(pool, 'vapid', () => webpush.generateVAPIDKeys())
webpush.setVapidDetails(process.env.VAPID_SUBJECT || (SECURE ? ORIGIN : 'mailto:admin@localhost'), vapid.publicKey, vapid.privateKey)

const publicUser = u => ({ id: u.id, name: u.name, role: u.role, admin: u.role === 'trainer' })
const sessionVersion = u => Number(u.session_version) || 0
const sign = p => p + '.' + crypto.createHmac('sha256', SECRET).update(p).digest('base64url')
const makeSession = u => sign(`${u.id}:${Date.now() + SESSION_DAYS * 86400000}:${sessionVersion(u)}`)
const sessionCookie = u => `gymsid=${makeSession(u)}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly;${SECURE} SameSite=Lax`
const clearCookie = `gymsid=; Path=/; Max-Age=0; HttpOnly;${SECURE} SameSite=Lax`

function verifySig(token) {
  const i = token.lastIndexOf('.'); if (i < 0) return null
  const payload = token.slice(0, i), mac = token.slice(i + 1)
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')
  try { return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected)) ? payload : null } catch { return null }
}
async function readSession(req) {
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(c => { const i = c.indexOf('='); return i < 0 ? ['', ''] : [c.slice(0, i).trim(), c.slice(i + 1).trim()] }))
  const payload = cookies.gymsid && verifySig(cookies.gymsid); if (!payload) return null
  const [id, expiry, version] = payload.split(':'); if (!id || +expiry < Date.now()) return null
  const user = await getUser(pool, id)
  return user && !user.disabled && Number(version || 0) === sessionVersion(user) ? user : null
}
async function requireUser(req, res) { const u = await readSession(req); if (!u) json(res, 401, { error: 'not signed in' }); return u }
async function requireTrainer(req, res) { const u = await requireUser(req, res); if (u && u.role !== 'trainer') { json(res, 403, { error: 'trainer access required' }); return null } return u }

const emailOf = value => String(value || '').trim().toLowerCase()
const validEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
function passwordMatches(password, encoded) {
  const [scheme, salt, expected] = String(encoded || '').split('$')
  if (scheme !== 'scrypt' || !salt || !expected) return false
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64url'), 64)
  const target = Buffer.from(expected, 'base64url')
  return target.length === actual.length && crypto.timingSafeEqual(actual, target)
}

function json(res, code, value, headers = {}) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(value)) }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = []
    req.on('data', d => { size += d.length; if (size > MAX_BODY) { reject(Object.assign(new Error('body too large'), { status: 413 })); req.destroy() } else chunks.push(d) })
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks)) : {}) } catch { reject(Object.assign(new Error('bad json'), { status: 400 })) } })
    req.on('error', reject)
  })
}

const presence = new Map(), restTimers = new Map(), PRESENCE_TTL = 70000
function livePresence(id) { const p = presence.get(id); if (!p || Date.now() - p.updatedAt > PRESENCE_TTL) { presence.delete(id); return null } return p }
setInterval(() => { for (const [id, p] of presence) if (Date.now() - p.updatedAt > PRESENCE_TTL) presence.delete(id) }, 30000).unref()
async function subscriptions(uid) { const [rows] = await pool.execute('SELECT endpoint,keys_json FROM push_subscriptions WHERE user_id=?', [uid]); return rows.map(r => ({ endpoint: r.endpoint, keys: parseJson(r.keys_json) })) }
async function sendPush(uid, payload) {
  for (const sub of await subscriptions(uid)) try { await webpush.sendNotification(sub, JSON.stringify(payload), { urgency: 'high' }) }
  catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await pool.execute('DELETE FROM push_subscriptions WHERE endpoint_hash=UNHEX(SHA2(?,256))', [sub.endpoint]); else console.error('push failed', e) }
}
function scheduleRest(uid, sec) { if (restTimers.has(uid)) clearTimeout(restTimers.get(uid)); restTimers.set(uid, setTimeout(() => { restTimers.delete(uid); sendPush(uid, { title: 'Rest over 💪', body: 'Time for your next set.', tag: 'rest-timer' }).catch(console.error) }, sec * 1000)) }

function effectiveRoutineId(S, iso) { const ov = S.dayPlan?.[iso]; if (ov === 'rest') return null; if (ov && S.routines?.some(r => r.id === ov)) return ov; return S.week?.[new Date(iso + 'T12:00:00').getDay()] || null }
function userNow(tz) { try { const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date()); const g = t => p.find(x => x.type === t)?.value; return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` } } catch { return null } }
setInterval(async () => {
  try {
    const [rows] = await pool.query('SELECT u.id,u.last_reminder_date,s.settings_json,s.plan_json,s.progress_json FROM users u JOIN client_states s ON s.user_id=u.id WHERE u.disabled=0')
    for (const row of rows) {
      const settings = parseJson(row.settings_json), plan = parseJson(row.plan_json), progress = parseJson(row.progress_json), now = userNow(settings.reminder?.tz || 'UTC')
      if (!settings.reminder?.on || !now || settings.reminder.time !== now.time || String(row.last_reminder_date || '').slice(0, 10) === now.date || (progress.workouts || []).some(w => w.d === now.date)) continue
      const rid = effectiveRoutineId(plan, now.date); if (!rid || !(await subscriptions(row.id)).length) continue
      const routine = (plan.routines || []).find(r => r.id === rid)
      await pool.execute('UPDATE users SET last_reminder_date=? WHERE id=?', [now.date, row.id])
      await sendPush(row.id, { title: routine ? `${routine.emoji || '🏋️'} ${routine.name} today` : 'Workout planned today', body: "It's on your plan — let's go 💪", tag: 'day-reminder' })
    }
  } catch (e) { console.error('reminder scan failed', e) }
}, 10000).unref()

async function inviteIsOpen(code) { const [rows] = await pool.execute('SELECT 1 FROM invites WHERE code=? AND used_by IS NULL AND revoked_at IS NULL', [code]); return !!rows.length }

const routes = {
  'GET /api/health': async (req, res) => { const [[c]] = await pool.query('SELECT COUNT(*) users FROM users'); json(res, 200, { ok: true, database: 'mysql', users: Number(c.users) }) },
  'GET /api/config': async (req, res) => json(res, 200, { invite_only: INVITE_ONLY }),
  'GET /api/me': async (req, res) => { const u = await requireUser(req, res); if (u) json(res, 200, { user: publicUser(u) }) },
  'POST /api/auth/register': async (req, res) => {
    const b = await readBody(req), name = String(b.name || '').trim().slice(0, 40), email = emailOf(b.email), password = String(b.password || ''), code = String(b.code || '').trim().toUpperCase()
    if (!name) return json(res, 400, { error: 'name required' }); if (INVITE_ONLY && !(await inviteIsOpen(code))) return json(res, 403, { error: 'a valid invite code is required' })
    if (!validEmail(email)) return json(res, 400, { error: 'valid email required' })
    if (password.length < 8 || password.length > 200) return json(res, 400, { error: 'password must be 8–200 characters' })
    if (await getUserByEmail(pool, email)) return json(res, 409, { error: 'an account already exists for this email' })
    const u = { id: crypto.randomBytes(12).toString('base64url'), name, email, passwordHash: hashPassword(password), created: new Date() }
    await createPasswordUser(pool, u, INVITE_ONLY ? code : null)
    const stored = await getUser(pool, u.id); json(res, 200, { user: publicUser(stored) }, { 'Set-Cookie': sessionCookie(stored) })
  },
  'POST /api/auth/login': async (req, res) => {
    const b = await readBody(req), email = emailOf(b.email), password = String(b.password || '')
    const u = await getUserByEmail(pool, email)
    if (!u || !passwordMatches(password, u.password_hash)) return json(res, 401, { error: 'invalid email or password' })
    if (u.disabled) return json(res, 403, { error: 'this account has been disabled' })
    json(res, 200, { user: publicUser(u) }, { 'Set-Cookie': sessionCookie(u) })
  },
  'POST /api/logout': async (req, res) => json(res, 200, { ok: true }, { 'Set-Cookie': clearCookie }),
  'POST /api/logout/all': async (req, res) => { const u = await requireUser(req, res); if (u) { await pool.execute('UPDATE users SET session_version=session_version+1 WHERE id=?', [u.id]); json(res, 200, { ok: true }, { 'Set-Cookie': clearCookie }) } },
  'GET /api/data': async (req, res) => { const u = await requireUser(req, res); if (u) json(res, 200, await readClientState(pool, u.id)) },
  'PUT /api/data': async (req, res) => { const u = await requireUser(req, res); if (!u) return; const b = await readBody(req); if (!b.state || typeof b.state !== 'object') return json(res, 400, { error: 'state required' }); delete b.state.active; json(res, 200, await saveClientState(pool, u, b.state, b.revisions || {})) },
  'GET /api/push/public-key': async (req, res) => json(res, 200, { key: vapid.publicKey }),
  'POST /api/push/subscribe': async (req, res) => { const u = await requireUser(req, res); if (!u) return; const sub = (await readBody(req)).subscription; if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return json(res, 400, { error: 'invalid subscription' }); await pool.execute('INSERT INTO push_subscriptions(user_id,endpoint_hash,endpoint,keys_json) VALUES (?,UNHEX(SHA2(?,256)),?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),keys_json=VALUES(keys_json)', [u.id, sub.endpoint, sub.endpoint, JSON.stringify(sub.keys)]); json(res, 200, { ok: true }) },
  'POST /api/push/unsubscribe': async (req, res) => { const u = await requireUser(req, res); if (!u) return; const b = await readBody(req); await pool.execute('DELETE FROM push_subscriptions WHERE user_id=? AND endpoint_hash=UNHEX(SHA2(?,256))', [u.id, b.endpoint || '']); json(res, 200, { ok: true }) },
  'POST /api/push/test': async (req, res) => { const u = await requireUser(req, res); if (u) { await sendPush(u.id, { title: 'ROZER', body: 'Test notification ✅ — this is what alerts look like.', tag: 'test' }); json(res, 200, { ok: true }) } },
  'POST /api/push/rest-timer': async (req, res) => { const u = await requireUser(req, res); if (!u) return; const sec = Math.max(1, Math.min(3600, Math.round(+(await readBody(req)).seconds || 0))); scheduleRest(u.id, sec); json(res, 200, { ok: true }) },
  'POST /api/push/rest-timer/cancel': async (req, res) => { const u = await requireUser(req, res); if (!u) return; if (restTimers.has(u.id)) clearTimeout(restTimers.get(u.id)); restTimers.delete(u.id); json(res, 200, { ok: true }) },
  'POST /api/activity': async (req, res) => { const u = await requireUser(req, res); if (!u) return; const b = await readBody(req); if (b.active) presence.set(u.id, { name: String(b.name || '').slice(0, 60), exIdx: +b.exIdx || 0, exTotal: +b.exTotal || 0, setsDone: +b.setsDone || 0, setsTotal: +b.setsTotal || 0, startedAt: +b.startedAt || Date.now(), updatedAt: Date.now() }); else presence.delete(u.id); json(res, 200, { ok: true }) },

  'GET /api/admin/users': async (req, res) => {
    if (!(await requireTrainer(req, res))) return
    const [users] = await pool.query('SELECT u.*,s.client_timestamp,s.progress_json,EXISTS(SELECT 1 FROM push_subscriptions p WHERE p.user_id=u.id) has_push FROM users u LEFT JOIN client_states s ON s.user_id=u.id ORDER BY u.name')
    json(res, 200, { users: users.map(u => { const p = parseJson(u.progress_json), w = p.workouts || [], last = w[w.length - 1]; return { id: u.id, name: u.name, created: u.created_at, disabled: !!u.disabled, role: u.role, admin: u.role === 'trainer', workouts: w.length, lastWorkout: last?.d || null, lastSync: Number(u.client_timestamp) || null, hasPush: !!u.has_push, live: livePresence(u.id) } }), invite_only: INVITE_ONLY, now: Date.now() })
  },
  'GET /api/admin/user': async (req, res) => {
    if (!(await requireTrainer(req, res))) return; const id = new URL(req.url, 'http://x').searchParams.get('id'), u = await getUser(pool, id); if (!u) return json(res, 404, { error: 'no such user' })
    const data = await readClientState(pool, id), S = data.state || {}; json(res, 200, { user: { ...publicUser(u), created: u.created_at, disabled: !!u.disabled, invitedBy: u.invited_by }, unit: S.unit || 'kg', lastSync: S._ts || null, routines: S.routines || [], bodyweight: S.bodyweight || [], workouts: (S.workouts || []).slice().reverse(), customEx: S.customEx || [], plan: { routines: S.routines || [], week: S.week || {}, dayPlan: S.dayPlan || {}, customEx: S.customEx || [] }, revisions: data.revisions })
  },
  'GET /api/admin/client/state': async (req, res) => { if (!(await requireTrainer(req, res))) return; const id = new URL(req.url, 'http://x').searchParams.get('id'), u = await getUser(pool, id); if (!u) return json(res, 404, { error: 'no such user' }); json(res, 200, { user: publicUser(u), ...(await readClientState(pool, id)) }) },
  'PUT /api/admin/client/plan': async (req, res) => { const t = await requireTrainer(req, res); if (!t) return; const b = await readBody(req), u = await getUser(pool, b.id); if (!u || u.role !== 'client') return json(res, 404, { error: 'no such client' }); json(res, 200, await saveTrainerPlan(pool, t, u.id, b.plan, b.baseVersion)) },
  'POST /api/admin/user/disable': async (req, res) => { if (!(await requireTrainer(req, res))) return; const b = await readBody(req), u = await getUser(pool, b.id); if (!u) return json(res, 404, { error: 'no such user' }); if (u.role === 'trainer') return json(res, 400, { error: 'cannot disable a trainer' }); await pool.execute('UPDATE users SET disabled=?,session_version=session_version+? WHERE id=?', [!!b.disabled, b.disabled ? 1 : 0, u.id]); if (b.disabled) presence.delete(u.id); json(res, 200, { ok: true, id: u.id, disabled: !!b.disabled }) },
  'POST /api/admin/user/role': async (req, res) => {
    const t = await requireTrainer(req, res); if (!t) return; const b = await readBody(req), role = b.role === 'trainer' ? 'trainer' : 'client', u = await getUser(pool, b.id); if (!u) return json(res, 404, { error: 'no such user' }); if (u.id === t.id && role !== 'trainer') return json(res, 400, { error: 'cannot demote yourself' })
    if (u.role === 'trainer' && role !== 'trainer') { const [[c]] = await pool.query("SELECT COUNT(*) total FROM users WHERE role='trainer'"); if (+c.total <= 1) return json(res, 400, { error: 'cannot remove the final trainer' }) }
    await pool.execute('UPDATE users SET role=? WHERE id=?', [role, u.id]); json(res, 200, { ok: true, id: u.id, role })
  },
  'GET /api/admin/invites': async (req, res) => { if (!(await requireTrainer(req, res))) return; const [rows] = await pool.query('SELECT i.*,u.name used_by_name FROM invites i LEFT JOIN users u ON u.id=i.used_by ORDER BY i.created_at DESC'); json(res, 200, { invites: rows.map(i => ({ code: i.code, note: i.note, createdBy: i.created_by, usedBy: i.used_by, usedByName: i.used_by_name, created: i.created_at, usedAt: i.used_at, revoked: !!i.revoked_at })), invite_only: INVITE_ONLY }) },
  'POST /api/admin/invites/new': async (req, res) => { const t = await requireTrainer(req, res); if (!t) return; const b = await readBody(req); let code; do { code = crypto.randomBytes(8).toString('hex').toUpperCase() } while (await inviteIsOpen(code)); await pool.execute('INSERT INTO invites(code,note,created_by) VALUES (?,?,?)', [code, String(b.note || '').slice(0, 60), t.id]); json(res, 200, { invite: { code, note: b.note || '', createdBy: t.id, created: new Date().toISOString() } }) },
  'POST /api/admin/invites/revoke': async (req, res) => { if (!(await requireTrainer(req, res))) return; const b = await readBody(req); const [r] = await pool.execute('UPDATE invites SET revoked_at=CURRENT_TIMESTAMP(3) WHERE code=? AND used_by IS NULL', [String(b.code || '').toUpperCase()]); if (!r.affectedRows) return json(res, 400, { error: 'invite not found or already used' }); json(res, 200, { ok: true }) }
}

const server = http.createServer(async (req, res) => { const url = new URL(req.url, 'http://x'), handler = routes[`${req.method} ${url.pathname}`]; if (!handler) return json(res, 404, { error: 'not found' }); try { await handler(req, res) } catch (e) { console.error(req.method, url.pathname, e); if (!res.headersSent) json(res, e.status || 500, { error: e.message || 'server error', currentVersion: e.currentVersion }) } })
server.listen(PORT, () => console.log(`gym-api on :${PORT} (mysql, origin=${ORIGIN})`))
async function shutdown() { server.close(); await pool.end(); process.exit(0) }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown)
