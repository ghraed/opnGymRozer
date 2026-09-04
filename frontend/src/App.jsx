import { useEffect, useRef, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { bindUI } from './components/ui.jsx'
import { ACCENTS } from './lib/format.js'
import { getLang, setLang, useLang } from './lib/i18n.js'
import { setNav } from './lib/nav.js'
import { useWakeLock } from './lib/wakelock.js'
import { startFlow } from './sheets.jsx'
import Icon from './components/Icon.jsx'
import TabBar from './components/TabBar.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Modals from './components/Modals.jsx'
import Toast from './components/Toast.jsx'
import RestTimer from './components/RestTimer.jsx'
import Login from './views/Login.jsx'
import Home from './views/Home.jsx'
import Plan from './views/Plan.jsx'
import RoutineEdit from './views/RoutineEdit.jsx'
import Workout from './views/Workout.jsx'
import Stats from './views/Stats.jsx'
import History from './views/History.jsx'
import Library from './views/Library.jsx'
import Settings from './views/Settings.jsx'
import Admin from './views/Admin.jsx'

bindUI(useUI)   // lets the shared controls open sheets without importing the store at module scope

function applyPrefs(theme, accent) {
  const de = document.documentElement
  de.dataset.theme = theme === 'light' ? 'light' : 'dark'
  de.dataset.accent = ACCENTS[accent] ? accent : 'lime'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = de.dataset.theme === 'light' ? '#f2f2f7' : '#000000'
}

// A sheet is an in-page state, just like the Android/iOS back affordance expects.
// Give each open sheet a same-URL history entry: Back then dismisses the top sheet
// before HashRouter gets a chance to leave the current screen.
function useSheetBackNavigation() {
  const sheets = useUI(s => s.sheets)
  const previous = useRef(sheets.length)
  const closedByBack = useRef(false)
  const ignoreProgrammaticBack = useRef(false)

  useEffect(() => {
    const onPopState = () => {
      if (ignoreProgrammaticBack.current) {
        ignoreProgrammaticBack.current = false
        return
      }
      const open = useUI.getState().sheets
      if (!open.length) return
      closedByBack.current = true
      useUI.getState().closeSheet(open[open.length - 1].id)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const before = previous.current
    const change = sheets.length - before
    if (change > 0) {
      // Sheets normally open one at a time, but support a caller opening several in
      // the same render as well.
      for (let i = 0; i < change; i++) {
        const sheet = sheets[before + i]
        window.history.pushState({ ...(window.history.state || {}), openGymSheet: sheet.id }, '', window.location.href)
      }
    } else if (change < 0 && !closedByBack.current && window.history.state?.openGymSheet) {
      // Closing through a button, a backdrop tap, or a swipe must discard the entry
      // we created. Ignore its popstate so it cannot dismiss the sheet underneath.
      ignoreProgrammaticBack.current = true
      window.history.go(change)
    }
    closedByBack.current = false
    previous.current = sheets.length
  }, [sheets])
}

// Native-like pull to refresh for the phone layout. It only begins at the top of the
// page and never competes with an open sheet or a scrolling list inside one.
function PullToRefresh() {
  const sheets = useUI(s => s.sheets)
  const [distance, setDistance] = useState(0)
  const [loading, setLoading] = useState(false)
  const gesture = useRef({ startY: 0, active: false, distance: 0 })

  useEffect(() => {
    const isPhone = () => window.matchMedia?.('(pointer: coarse)').matches
    const onStart = e => {
      if (loading || sheets.length || !isPhone() || window.scrollY > 0 || e.touches.length !== 1) return
      gesture.current = { startY: e.touches[0].clientY, active: true, distance: 0 }
    }
    const onMove = e => {
      const g = gesture.current
      if (!g.active) return
      const moved = Math.max(0, e.touches[0].clientY - g.startY)
      if (!moved) return
      e.preventDefault()
      g.distance = Math.min(104, moved * 0.48)
      setDistance(g.distance)
    }
    const onEnd = () => {
      const g = gesture.current
      if (!g.active) return
      g.active = false
      if (g.distance < 68) { setDistance(0); return }
      const refresh = async () => {
        if (useStore.getState().hasUnsavedChanges() && !window.confirm('Some changes have not been saved to your account yet. Refresh anyway?')) {
          setDistance(0)
          return
        }
        setLoading(true)
        // pullState uploads a newer local copy before accepting a newer server copy,
        // so refresh cannot silently replace the user’s latest workout or plan edit.
        await Promise.race([
          useStore.getState().pullState(),
          new Promise(resolve => window.setTimeout(resolve, 10000)),
        ])
        window.location.reload()
      }
      refresh()
    }
    const onCancel = () => {
      gesture.current.active = false
      gesture.current.distance = 0
      setDistance(0)
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onCancel, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onCancel)
    }
  }, [loading, sheets.length])

  const visible = loading || distance > 0
  return <div className={'pull-refresh' + (loading ? ' loading' : '')} aria-hidden={!visible}
    style={{ transform: `translate(-50%, ${loading ? 14 : -42 + distance}px)`, opacity: visible ? 1 : 0 }}>
    <span />
  </div>
}

function Shell() {
  const navigate = useNavigate()
  const loc = useLocation()
  const { S, user, ready } = useStore()
  const isGuest = useStore(s => s.isGuest())
  const langV = useLang()   // re-renders the whole shell when the language (pack) changes
  useSheetBackNavigation()
  useEffect(() => { setNav(navigate) }, [navigate])
  useEffect(() => { applyPrefs(S.theme, S.accent) }, [S.theme, S.accent])
  useEffect(() => { setLang(S.lang || 'en') }, [S.lang])
  useEffect(() => {
    const activeLang = getLang()
    document.documentElement.lang = activeLang
    document.documentElement.dir = activeLang === 'ar' ? 'rtl' : 'ltr'
  }, [langV])
  // every tab/route change starts at the top of the page
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  // bound to the workout, not to the route — checking Stats mid-session keeps the screen on
  useWakeLock(!!S.active && S.keepAwake !== false)

  const authed = user || isGuest
  if (!ready && !authed) return (
    <div id="app">
      <div style={{ paddingTop: '44vh', display: 'flex', justifyContent: 'center', fontSize: 34, color: 'var(--label-3)' }}>
        <Icon name="dumbbell" />
      </div>
    </div>
  )

  return (
    <>
      {/* keyed on the route: a view that throws is contained, and switching tabs
          re-mounts the boundary, so the tab bar is always a way out */}
      <div id="app" className="vfade" key={loc.pathname}>
        <ErrorBoundary>
          {!authed ? <Login /> : (
            <Routes>
              <Route path="/home" element={<Home />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/plan/r/:id" element={<RoutineEdit />} />
              <Route path="/workout" element={<Workout />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/history" element={<History />} />
              <Route path="/library" element={<Library />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={user?.admin ? <Admin /> : <Navigate to="/home" replace />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          )}
        </ErrorBoundary>
      </div>
      <TabBar onStart={startFlow} />
      <RestTimer />
      <PullToRefresh />
      <Modals />
      <Toast />
    </>
  )
}

export default function App() {
  const boot = useStore(s => s.boot)
  useEffect(() => { boot() }, [boot])
  return <HashRouter><Shell /></HashRouter>
}
