import { useStore, hasData } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { passwordLogin, passwordRegister, api } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import { needsActivation } from '../lib/activation.js'
import { DEMO } from '../lib/demo.js'
import { useState, useRef, useEffect } from 'react'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { onboardingSheet } from '../sheets.jsx'

function PasswordField({ value, onChange, busy, register = false, confirm = false }) {
  const [visible, setVisible] = useState(false)
  const id = confirm ? 'register-confirm-password' : register ? 'register-password' : 'signin-password'
  return <div className="auth-field">
    <label htmlFor={id}>{t(confirm ? 'Confirm password' : 'Password')}</label>
    <div className="auth-password">
      <input id={id} className="input" type={visible ? 'text' : 'password'} name={confirm ? 'confirmPassword' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} placeholder={t(confirm ? 'Repeat your password' : register ? 'Password (at least 8 characters)' : 'Enter your password')} required minLength={register ? 8 : undefined} maxLength={register ? 200 : undefined} value={value} onChange={onChange} disabled={busy} />
      <button type="button" className="auth-password-toggle" aria-label={t(visible ? 'Hide password' : 'Show password')} aria-pressed={visible} onClick={() => setVisible(!visible)} disabled={busy}>
        <svg viewBox="0 0 24 24" className="icn" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{visible && <path d="m3 3 18 18" />}</svg>
      </button>
    </div>
  </div>
}

function RegisterForm({ busy, setBusy }) {
  const { setUser, pushState, pullState } = useStore()
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirmPassword, setConfirmPassword] = useState(''), [code, setCode] = useState(''), [inviteOnly, setInviteOnly] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef(null)
  useEffect(() => { if (!window.matchMedia('(max-width: 700px)').matches) ref.current?.focus() }, [])
  useEffect(() => { api('/api/config').then(c => setInviteOnly(!!c.invite_only)).catch(() => { }) }, [])
  const go = async () => {
    if (busy) return
    if (!name.trim() || !email.trim() || !password || !confirmPassword) return setError(t('Complete all fields'))
    if (password !== confirmPassword) return setError(t('Passwords do not match'))
    if (inviteOnly && !code.trim()) return setError(t('An invite code is required'))
    setError('')
    setBusy(true)
    try {
      const u = await passwordRegister(name.trim(), email.trim(), password, code.trim())
      setUser(u)
      if (needsActivation(u)) return
      if (hasData(useStore.getState().S)) { await pushState(); useUI.getState().toast(t('Profile created — data from this device moved into it')) }
      else { await pullState(); useUI.getState().toast(t('Welcome, {0}', u.name)) }
      if (u.admin) onboardingSheet()
    } catch (e) { setError(e.message || t('Registration failed')) } finally { setBusy(false) }
  }
  return <div className="auth-register">
    <form className="auth-form" onChange={() => setError('')} onSubmit={event => { event.preventDefault(); go() }} aria-busy={busy}>
      <label className="auth-field">{t('Your name')}<input ref={ref} className="input" name="name" autoComplete="name" placeholder={t('Your name')} required maxLength={40} value={name} onChange={e => setName(e.target.value)} disabled={busy} /></label>
      <label className="auth-field">{t('Email address')}<input className="input" type="email" name="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>
      <div className="auth-password-fields">
        <PasswordField register value={password} onChange={e => setPassword(e.target.value)} busy={busy} />
        <PasswordField register confirm value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} busy={busy} />
      </div>
      {inviteOnly && <label className="auth-field">{t('Invite code')}<input className="input auth-invite" name="code" placeholder={t('Invite code')} required maxLength={40} value={code} onChange={e => setCode(e.target.value.toUpperCase())} disabled={busy} /></label>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <Button type="submit" variant="primary" disabled={busy}>{busy ? t('Creating account…') : t('Create account')}</Button>
    </form>
    <p className="auth-setup-note"><Icon name="personCircle" /><span>{t('During profile setup, you can upload a profile photo and choose your training days per week.')}</span></p>
  </div>
}

export default function Login() {
  const { setUser, pullState, setGuest } = useStore()
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [remember, setRemember] = useState(true), [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('signin')
  const registering = mode === 'register'
  const changeMode = next => { if (!busy) { setError(''); setMode(next) } }
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
    <header className="auth-topbar">
      <div className="auth-wordmark"><span className="auth-brand-mark"><img src="/brand/rozer-logo.png" alt="" width="1254" height="1254" /></span><strong>ROZER</strong></div>
      <div className="auth-mode-switch" role="group" aria-label={t('Account access')}>
        <button type="button" aria-pressed={!registering} disabled={busy} onClick={() => changeMode('signin')}>{t('Sign in')}</button>
        <button type="button" aria-pressed={registering} disabled={busy} onClick={() => changeMode('register')}>{t('Create account')}</button>
      </div>
    </header>
    <div className="auth-layout">
      <section className="auth-brand" aria-label="ROZER">
        <div className="auth-brand-copy">
          <p className="auth-eyebrow"><span />{t('Your training, app.')}</p>
          <h1>{t('Build a stronger you.')}</h1>
          <p className="auth-brand-description">{t('Your workouts. Your weights. Your profile.')}</p>
          <ul className="auth-features">
            <li><Icon name="calendar" /><span>{t('Plan')}</span></li>
            <li><Icon name="dumbbell" /><span>{t('Workouts')}</span></li>
            <li><Icon name="chartLine" /><span>{t('Progress & history')}</span></li>
          </ul>
        </div>
        <p className="auth-brand-footer"><Icon name="shield" /><span>{t('Each profile keeps its own plan, workouts & body weight.')}</span></p>
      </section>
      <section className="auth-panel" aria-labelledby="auth-title">
        <header className="auth-panel-header">
          <h2 id="auth-title">{t(registering ? 'Create your account' : 'Welcome back')}</h2>
          <p>{t(registering ? 'Create your profile and set up a plan that fits you.' : 'Sign in to continue your training.')}</p>
        </header>
        {registering ? <RegisterForm busy={busy} setBusy={setBusy} /> : <form className="auth-form" onSubmit={event => { event.preventDefault(); signIn() }} aria-busy={busy}>
          <label className="auth-field">{t('Email address')}<input className="input" type="email" name="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={e => { setEmail(e.target.value); setError('') }} disabled={busy} /></label>
          <PasswordField value={password} onChange={e => { setPassword(e.target.value); setError('') }} busy={busy} />
          <label className="auth-remember"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} disabled={busy} /><span>{t('Remember me for 90 days')}</span></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <Button type="submit" variant="primary" className="auth-signin" disabled={busy}>{busy ? t('Signing in…') : t('Sign in')}</Button>
        </form>}
        <div className="auth-panel-footer"><Icon name="lock" /><span>{t('Your training, app.')}</span></div>
      </section>
    </div>
  </main>
}
