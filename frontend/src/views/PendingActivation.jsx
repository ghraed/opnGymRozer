import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { needsActivation } from '../lib/activation.js'
import { t } from '../lib/i18n.js'
import { useStore } from '../store/useStore.js'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

export default function PendingActivation() {
  const user = useStore(s => s.user)
  const navigate = useNavigate()
  const checking = useRef(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const check = useCallback(async () => {
    if (checking.current) return
    checking.current = true
    setBusy(true)
    try {
      const { user: current } = await api('/api/me')
      if (useStore.getState().user?.id !== current.id) return
      if (!needsActivation(current)) {
        useStore.getState().setUser(current)
        await useStore.getState().pullState()
        if (useStore.getState().user?.id === current.id) {
          navigate(useStore.getState().profileConfirmed ? '/home' : '/setup/1', { replace: true })
        }
      } else setMessage(t('Your account is still waiting for trainer approval.'))
    } catch (e) {
      if (e.status === 401) {
        useStore.getState().setUser(null)
        navigate('/home', { replace: true })
      } else setMessage(t('Unable to check right now. Please try again.'))
    } finally { checking.current = false; setBusy(false) }
  }, [navigate])

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    const interval = setInterval(onVisible, 15000)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [check])

  return <main className="activation-page">
    <img src="/brand/rozer-logo.png" className="login-logo" alt="ROZER" width="1254" height="1254" />
    <section className="card activation-card" aria-labelledby="pending-title">
      <div className="activation-icon" aria-hidden="true"><Icon name="clock" /></div>
      <p className="small muted">{t('Hi, {0}', user.name)}</p>
      <h1 id="pending-title">{t('Waiting for your trainer to activate your account')}</h1>
      <p className="muted">{t('You’re signed in. Your trainer needs to activate your account before you can access your plan and start logging workouts.')}</p>
      <p className="small muted">{t('This page checks automatically. You can also check again below.')}</p>
      <Button variant="primary" onClick={check} disabled={busy}>{busy ? t('Checking…') : t('Check activation status')}</Button>
      <p className="small muted activation-status" role="status">{message}</p>
      <Button onClick={async () => { await useStore.getState().signOut(); navigate('/home', { replace: true }) }}>{t('Sign out')}</Button>
    </section>
  </main>
}
