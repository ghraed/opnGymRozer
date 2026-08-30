export const IS_ANDROID = /Android/.test(navigator.userAgent)

export async function api(path, opts) {
  const r = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts))
  const data = await r.json().catch(() => ({}))
  if (!r.ok) { const e = new Error(data.error || ('HTTP ' + r.status)); e.status = r.status; e.data = data; throw e }
  return data
}

export async function passwordRegister(name, email, password, code) {
  const res = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, code: code || '' }) })
  return res.user
}
export async function passwordLogin(email, password) {
  const res = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
  return res.user
}
