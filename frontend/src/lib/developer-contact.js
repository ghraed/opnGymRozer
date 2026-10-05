const WHATSAPP_URL = 'whatsapp://send?phone=96171251044'
const DIAL_URL = 'tel:+96171251044'
let cancelPending = null

export function contactDeveloper() {
  cancelPending?.()
  let timer
  const cleanup = () => {
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', cleanup)
    cancelPending = null
  }
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') cleanup()
  }
  const dial = () => {
    cleanup()
    window.location.href = DIAL_URL
  }
  cancelPending = cleanup
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', cleanup)
  // Browsers expose no installed-app check. Leaving the page cancels the
  // fallback so returning from WhatsApp never opens the dialer as well.
  timer = setTimeout(() => {
    if (document.visibilityState === 'visible') dial()
    else cleanup()
  }, 2500)
  try { window.location.href = WHATSAPP_URL }
  catch { dial() }
}
