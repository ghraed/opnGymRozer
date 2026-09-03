import { useStore, hasData } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { passwordLogin, passwordRegister, api } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import { DEMO } from '../lib/demo.js'
import { useState, useRef, useEffect } from 'react'
import { Button } from '../components/ui.jsx'
import { onboardingSheet } from '../sheets.jsx'

function RegisterSheet({ close }) {
  const { setUser, pushState, pullState } = useStore()
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [code, setCode] = useState(''), [inviteOnly, setInviteOnly] = useState(false), [busy, setBusy] = useState(false)
  const ref = useRef(null)
  useEffect(() => { setTimeout(() => ref.current?.focus(), 250) }, [])
  useEffect(() => { api('/api/config').then(c => setInviteOnly(!!c.invite_only)).catch(() => {}) }, [])
  const go = async () => {
    if (!name.trim() || !email.trim() || !password) return useUI.getState().toast(t('Complete all fields'))
    if (inviteOnly && !code.trim()) return useUI.getState().toast(t('An invite code is required'))
    setBusy(true)
    try {
      const u = await passwordRegister(name.trim(), email.trim(), password, code.trim())
      setUser(u); close()
      if (hasData(useStore.getState().S)) { await pushState(); useUI.getState().toast(t('Profile created — data from this device moved into it')) }
      else { await pullState(); useUI.getState().toast(t('Welcome, {0}', u.name)) }
      onboardingSheet()
    } catch (e) { useUI.getState().toast(e.message || t('Registration failed')) } finally { setBusy(false) }
  }
  return <>
    <img className="register-logo" src="/rozer-logo.png" alt="ROZER" width="1254" height="1254" />
    <h3>{t('Create your account')}</h3>
    <div className="muted small" style={{ marginBottom: 14 }}>{t('Use your email and a password of at least 8 characters.')}</div>
    <input ref={ref} className="input" placeholder={t('Your name')} maxLength={40} value={name} onChange={e => setName(e.target.value)} />
    <div style={{ height: 10 }} /><input className="input" type="email" autoComplete="email" placeholder={t('Email address')} value={email} onChange={e => setEmail(e.target.value)} />
    <div style={{ height: 10 }} /><input className="input" type="password" autoComplete="new-password" placeholder={t('Password (at least 8 characters)')} value={password} onChange={e => setPassword(e.target.value)} />
    {inviteOnly && <><div style={{ height: 10 }} /><input className="input" placeholder={t('Invite code')} maxLength={40} value={code} onChange={e => setCode(e.target.value.toUpperCase())} style={{ letterSpacing: '.14em', fontWeight: 600, textAlign: 'center' }} /></>}
    <div style={{ height: 12 }} /><Button variant="primary" onClick={go} disabled={busy}>{busy ? t('Creating account…') : t('Create account')}</Button>
  </>
}

export default function Login() {
  const { setUser, pullState, setGuest } = useStore()
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false)
  const signIn = async () => {
    if (!email.trim() || !password) return useUI.getState().toast(t('Enter your email and password'))
    setBusy(true)
    try { const u = await passwordLogin(email.trim(), password); setUser(u); await pullState(); useUI.getState().toast(t('Welcome back, {0}', u.name)) }
    catch (e) { useUI.getState().toast(e.message || t('Sign-in failed')) } finally { setBusy(false) }
  }
  const head = <img className="login-logo" src="/rozer-logo.png" alt="ROZER" width="800" height="800" />
  const wrap = { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '78vh', textAlign: 'center' }
  if (DEMO) return <div className="narrow" style={wrap}>{head}<div className="muted" style={{ marginBottom: 30 }}>{t('Live demo — everything stays in this browser.')}</div><Button variant="primary" icon="sparkles" onClick={() => setGuest(true)}>{t('Start the demo')}</Button></div>
  return <div className="narrow" style={wrap}>
    {head}<div className="muted" style={{ marginBottom: 24 }}>{t('Your workouts. Your weights. Your profile.')}</div>
    <input className="input" type="email" autoComplete="email" placeholder={t('Email address')} value={email} onChange={e => setEmail(e.target.value)} />
    <div style={{ height: 10 }} /><input className="input" type="password" autoComplete="current-password" placeholder={t('Password')} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && signIn()} />
    <div style={{ height: 12 }} /><Button variant="primary" icon="person" onClick={signIn} disabled={busy}>{busy ? t('Signing in…') : t('Sign in')}</Button>
    <div style={{ height: 10 }} /><Button icon="sparkles" onClick={() => useUI.getState().openSheet(close => <RegisterSheet close={close} />)}>{t('Create account')}</Button>
    <div style={{ height: 10 }} /><Button variant="ghost" className="dim" onClick={() => setGuest(true)}>{t('Continue without account')}</Button>
    <div className="dim small" style={{ marginTop: 26, lineHeight: 1.5 }}>{t('Each profile keeps its own plan, workouts & body weight.')}</div>
  </div>
}
