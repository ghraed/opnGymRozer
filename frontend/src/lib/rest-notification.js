import { Capacitor, registerPlugin } from '@capacitor/core'
import { MOBILE } from './mobile.js'
import { t } from './i18n.js'

const RestTimer = registerPlugin('RestTimer')
export const nativeRestSupported = () => MOBILE && Capacitor.getPlatform() === 'android'

// Permission prompts and native calls can take longer than a rest. Serialize mutations so
// a slow start cannot resurrect a notification after cancellation or replace a newer rest.
let pending = Promise.resolve()
let revision = 0
let ownedEndsAt = null
const enqueue = fn => {
  const result = pending.then(fn).catch(() => false)
  pending = result
  return result
}

export function syncRestNotification(timer, sound) {
  if (!nativeRestSupported()) return Promise.resolve(false)
  const current = ++revision
  return enqueue(async () => {
    if (current !== revision) return false
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    let permission = await LocalNotifications.checkPermissions()
    if (permission.display === 'prompt' || permission.display === 'prompt-with-rationale') {
      permission = await LocalNotifications.requestPermissions()
    }
    if (current !== revision) return false
    if (permission.display !== 'granted') {
      ownedEndsAt = null
      await RestTimer.cancel()
      return false
    }
    const result = await RestTimer.start({
      endsAt: timer.endsAt, total: timer.total, sound,
      title: t('Rest'), body: t('Rest over — next set!'),
    })
    ownedEndsAt = result.handled ? timer.endsAt : null
    return result.handled
  })
}

export function cancelRestNotification() {
  if (!nativeRestSupported()) return Promise.resolve(false)
  revision++
  return enqueue(async () => {
    await RestTimer.cancel()
    ownedEndsAt = null
  })
}

export function finishRestNotification(endsAt) {
  if (!nativeRestSupported()) return Promise.resolve(false)
  return enqueue(async () => {
    try { return (await RestTimer.finish({ endsAt })).handled }
    // A successful start already gave the OS ownership of the end alert. If the
    // bridge fails on resume, do not add a local alert alongside its scheduled alarm.
    catch { return ownedEndsAt === endsAt }
  })
}

export function restoreRestNotification() {
  if (!nativeRestSupported()) return Promise.resolve(null)
  return enqueue(async () => {
    const timer = (await RestTimer.getState()).timer || null
    if (timer) ownedEndsAt = timer.endsAt
    return timer
  })
}
