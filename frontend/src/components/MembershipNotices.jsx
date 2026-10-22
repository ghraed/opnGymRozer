import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useStore } from '../store/useStore.js'
import { Button } from './ui.jsx'

export default function MembershipNotices() {
  const user = useStore(s => s.user)
  const [reminders, setReminders] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  useEffect(() => {
    if (user?.role !== 'client') return
    const controller = new AbortController()
    const load = () => api('/api/member/reminders', { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setReminders(data.reminders) }).catch(() => {})
    load(); const interval = setInterval(load, 60000)
    return () => { controller.abort(); clearInterval(interval) }
  }, [user?.id, user?.role])
  if (user?.role !== 'client' || !reminders.length) return null
  const dismiss = async id => {
    setBusy(id); setError('')
    try { await api('/api/member/reminder/read', { method: 'POST', body: JSON.stringify({ id }) }); setReminders(current => current.filter(r => r.id !== id)) }
    catch (e) { setError(e.message) } finally { setBusy(null) }
  }
  return <section className="membership-notices" aria-label="Your membership reminders">{reminders.map(reminder => <article className="card" key={reminder.id}><h2>{reminder.title}</h2><p>{reminder.body}</p><Button size="sm" disabled={!!busy} onClick={() => dismiss(reminder.id)}>{busy === reminder.id ? 'Dismissing…' : 'Dismiss reminder'}</Button></article>)}{error && <p role="alert">{error}</p>}</section>
}
