import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { MOBILE } from './lib/mobile.js'
import { DEMO } from './lib/demo.js'
import { legacyWebPath } from './lib/routing.js'
import './index.css'

if (!MOBILE && !DEMO) {
  const path = legacyWebPath(window.location.hash)
  if (path) window.history.replaceState(window.history.state, '', path)
}

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>
)

// Not in the mobile build: the native shell already serves everything from disk.
// Localhost over HTTP is also a secure context and needs the worker for Web Push.
if (!MOBILE && 'serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
