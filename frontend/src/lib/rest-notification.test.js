import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  platform: vi.fn(() => 'android'),
  start: vi.fn(async () => ({ handled: true })), cancel: vi.fn(async () => ({})),
  finish: vi.fn(async () => ({ handled: true })),
  getState: vi.fn(async () => ({})),
  checkPermissions: vi.fn(async () => ({ display: 'granted' })),
  requestPermissions: vi.fn(async () => ({ display: 'granted' })),
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: mocks.platform }, registerPlugin: () => mocks }))
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: mocks }))
vi.mock('./mobile.js', () => ({ MOBILE: true }))
vi.mock('./i18n.js', () => ({ t: s => s }))
let notifications
beforeEach(async () => {
  vi.clearAllMocks()
  mocks.platform.mockReturnValue('android')
  mocks.start.mockResolvedValue({ handled: true })
  mocks.finish.mockResolvedValue({ handled: true })
  mocks.checkPermissions.mockResolvedValue({ display: 'granted' })
  mocks.requestPermissions.mockResolvedValue({ display: 'granted' })
  vi.resetModules()
  notifications = await import('./rest-notification.js')
})
const timer = { endsAt: 160000, total: 60 }

describe('native notification ordering and failures', () => {
  it('passes the shared deadline, translated copy and sound setting to native', async () => {
    expect(await notifications.syncRestNotification(timer, false)).toBe(true)
    expect(mocks.start).toHaveBeenCalledWith({ endsAt: 160000, total: 60, title: 'Rest', body: 'Rest over — next set!', sound: false })
  })

  it('denied permission clears any prior notification without scheduling or throwing', async () => {
    mocks.checkPermissions.mockResolvedValue({ display: 'denied' })
    expect(await notifications.syncRestNotification(timer, true)).toBe(false)
    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.requestPermissions).not.toHaveBeenCalled()
    expect(mocks.cancel).toHaveBeenCalledTimes(1)
  })

  it('cannot resurrect a cancelled timer when a permission prompt returns late', async () => {
    let grant
    mocks.checkPermissions.mockResolvedValue({ display: 'prompt' })
    mocks.requestPermissions.mockImplementation(() => new Promise(resolve => { grant = resolve }))
    const first = notifications.syncRestNotification(timer, true)
    await vi.waitFor(() => expect(grant).toBeTypeOf('function'))
    const cancel = notifications.cancelRestNotification()
    grant({ display: 'granted' })
    expect(await first).toBe(false)
    await cancel
    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.cancel).toHaveBeenCalledTimes(1)
  })

  it('only schedules the newest consecutive timer', async () => {
    const first = notifications.syncRestNotification(timer, true)
    const second = notifications.syncRestNotification({ endsAt: 190000 }, true)
    await Promise.all([first, second])
    expect(mocks.start).toHaveBeenCalledTimes(1)
    expect(mocks.start.mock.calls[0][0].endsAt).toBe(190000)
  })

  it('serializes native mutations, including completion after scheduling', async () => {
    const start = notifications.syncRestNotification(timer, true)
    const finish = notifications.finishRestNotification(timer.endsAt)
    await Promise.all([start, finish])
    expect(mocks.start.mock.invocationCallOrder[0]).toBeLessThan(mocks.finish.mock.invocationCallOrder[0])
  })

  it('contains plugin rejection and lets later cancellation run', async () => {
    mocks.start.mockRejectedValueOnce(new Error('plugin unavailable'))
    expect(await notifications.syncRestNotification(timer, true)).toBe(false)
    await notifications.cancelRestNotification()
    expect(mocks.cancel).toHaveBeenCalledTimes(1)
  })

  it('does not duplicate an OS-owned alert if the completion bridge rejects', async () => {
    await notifications.syncRestNotification(timer, true)
    mocks.finish.mockRejectedValueOnce(new Error('bridge disconnected'))
    expect(await notifications.finishRestNotification(timer.endsAt)).toBe(true)
  })

  it('allows local fallback when completion rejects and native never owned the rest', async () => {
    mocks.checkPermissions.mockResolvedValue({ display: 'denied' })
    await notifications.syncRestNotification(timer, true)
    mocks.finish.mockRejectedValueOnce(new Error('bridge disconnected'))
    expect(await notifications.finishRestNotification(timer.endsAt)).toBe(false)
  })

  it('does not call the Android plugin on iOS or web', async () => {
    for (const platform of ['ios', 'web']) {
      mocks.platform.mockReturnValue(platform)
      expect(await notifications.syncRestNotification(timer, true)).toBe(false)
      await notifications.cancelRestNotification()
      expect(await notifications.finishRestNotification(timer.endsAt)).toBe(false)
    }
    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.cancel).not.toHaveBeenCalled()
    expect(mocks.finish).not.toHaveBeenCalled()
  })
})
