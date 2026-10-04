import { useStore, hasData } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { passwordLogin, passwordRegister, api } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import { needsActivation } from '../lib/activation.js'
import { DEMO } from '../lib/demo.js'
import { useState, useRef, useEffect } from 'react'
import { Button } from '../components/ui.jsx'
import { onboardingSheet } from '../sheets.jsx'

function RegisterSheet({ close }) {
  const { setUser, pushState, pullState } = useStore()
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [code, setCode] = useState(''), [inviteOnly, setInviteOnly] = useState(false), [busy, setBusy] = useState(false)
  const ref = useRef(null)
  useEffect(() => { setTimeout(() => ref.current?.focus(), 250) }, [])
  useEffect(() => { api('/api/config').then(c => setInviteOnly(!!c.invite_only)).catch(() => { }) }, [])
  const go = async () => {
    if (busy) return
    if (!name.trim() || !email.trim() || !password) return useUI.getState().toast(t('Complete all fields'))
    if (inviteOnly && !code.trim()) return useUI.getState().toast(t('An invite code is required'))
    setBusy(true)
    try {
      const u = await passwordRegister(name.trim(), email.trim(), password, code.trim())
      setUser(u); close()
      if (needsActivation(u)) return
      if (hasData(useStore.getState().S)) { await pushState(); useUI.getState().toast(t('Profile created — data from this device moved into it')) }
      else { await pullState(); useUI.getState().toast(t('Welcome, {0}', u.name)) }
      if (u.admin) onboardingSheet()
    } catch (e) { useUI.getState().toast(e.message || t('Registration failed')) } finally { setBusy(false) }
  }
  return <div className="auth-gold auth-register">
    <img className="register-logo" src="/brand/rozer-logo.png" alt="ROZER" width="1254" height="1254" />
    <h3>{t('Create your account')}</h3>
    <div className="muted small" style={{ marginBottom: 14 }}>{t('Use your email and a password of at least 8 characters.')}</div>
    <p className="small registration-setup-note">{t('During profile setup, you can upload a profile photo and choose your training days per week.')}</p>
    <form className="auth-form" onSubmit={event => { event.preventDefault(); go() }}>
      <label className="auth-field">{t('Your name')}<input ref={ref} className="input" name="name" autoComplete="name" placeholder={t('Your name')} required maxLength={40} value={name} onChange={e => setName(e.target.value)} disabled={busy} /></label>
      <label className="auth-field">{t('Email address')}<input className="input" type="email" name="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>
      <label className="auth-field">{t('Password')}<input className="input" type="password" name="password" autoComplete="new-password" placeholder={t('Password (at least 8 characters)')} required minLength={8} maxLength={200} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>
      {inviteOnly && <label className="auth-field">{t('Invite code')}<input className="input auth-invite" placeholder={t('Invite code')} required maxLength={40} value={code} onChange={e => setCode(e.target.value.toUpperCase())} disabled={busy} /></label>}
      <Button type="submit" variant="primary" disabled={busy}>{busy ? t('Creating account…') : t('Create account')}</Button>
    </form>
  </div>
}

export default function Login() {
  const { setUser, pullState, setGuest } = useStore()
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [remember, setRemember] = useState(true), [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const signIn = async () => {
    if (busy) return
    if (!email.trim() || !password) return setError(t('Enter your email and password'))
    setError('')
    setBusy(true)
    try { const u = await passwordLogin(email.trim(), password, remember); setUser(u); if (needsActivation(u)) return; await pullState(); useUI.getState().toast(t('Welcome back, {0}', u.name)) }
    catch (e) { setError(e.message || t('Sign-in failed')) } finally { setBusy(false) }
  }
  const head = <img className="login-logo" src="/brand/rozer-logo.png" alt="ROZER" width="1254" height="1254" />
  const wrap = { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '78vh', textAlign: 'center' }
  if (DEMO) return <div className="narrow auth-gold" style={wrap}>{head}<div className="muted" style={{ marginBottom: 30 }}>{t('Live demo — everything stays in this browser.')}</div><Button variant="primary" icon="sparkles" onClick={() => setGuest(true)}>{t('Start the demo')}</Button></div>
  return <main className="auth-page auth-gold">
    <div className="auth-layout">
      <section className="auth-brand" aria-label="ROZER">
        {head}
        <div className="auth-brand-copy">
          <p className="auth-eyebrow">{t('Your training, app.')}</p>
          <h1>{t('Build a stronger you.')}</h1>
          <p className="auth-brand-description">{t('Your workouts. Your weights. Your profile.')}</p>
        </div>
        <p className="auth-brand-footer">{t('Each profile keeps its own plan, workouts & body weight.')}</p>
      </section>
      <section className="auth-panel" aria-labelledby="signin-title">
        <header className="auth-panel-header">
          <h2 id="signin-title">{t('Welcome back')}</h2>
          <p>{t('Sign in to continue your training.')}</p>
        </header>
        <form className="auth-form" onSubmit={event => { event.preventDefault(); signIn() }}>
          <label className="auth-field">{t('Email address')}<input className="input" type="email" name="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={e => { setEmail(e.target.value); setError('') }} disabled={busy} /></label>
          <label className="auth-field">{t('Password')}<input className="input" type="password" name="password" autoComplete="current-password" placeholder={t('Enter your password')} required value={password} onChange={e => { setPassword(e.target.value); setError('') }} disabled={busy} /></label>
          <label className="auth-remember"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} disabled={busy} /><span>{t('Remember me for 90 days')}</span></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <Button type="submit" className="auth-signin" disabled={busy}>{busy ? t('Signing in…') : t('Sign in')}</Button>
        </form>
        <div className="auth-divider"><span>{t('New to ROZER?')}</span></div>
        <section className="auth-join" aria-labelledby="join-title">
          <h3 id="join-title">{t('Start your training journey')}</h3>
          <p>{t('Create your profile and set up a plan that fits you.')}</p>
          <Button type="button" variant="primary" className="auth-create" disabled={busy} onClick={() => useUI.getState().openSheet(close => <RegisterSheet close={close} />)}>{t('Create account')}</Button>
        </section>
      </section>
    </div>
  </main>
}
