import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  nativeRestSupported: vi.fn(() => true), syncRestNotification: vi.fn(),
  cancelRestNotification: vi.fn(), finishRestNotification: vi.fn(async () => true),
  restoreRestNotification: vi.fn(async () => null),
  beep: vi.fn(), vibrate: vi.fn(), api: vi.fn(async () => ({})),
  state: { user: { id: 1 }, S: { sound: true } },
}))
vi.mock('../lib/rest-notification.js', () => mocks)
vi.mock('../lib/sound.js', () => mocks)
vi.mock('../lib/api.js', () => mocks)
vi.mock('./useStore.js', () => ({ useStore: { getState: () => mocks.state } }))

let useUI, listeners
beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(100000)
  vi.clearAllMocks()
  mocks.nativeRestSupported.mockReturnValue(true)
  mocks.finishRestNotification.mockResolvedValue(true)
  mocks.restoreRestNotification.mockResolvedValue(null)
  listeners = new Set()
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  })
  vi.resetModules()
  ;({ useUI } = await import('./useUI.js'))
})
afterEach(() => {
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('rest timer notification integration', () => {
  it('restores a cold-launch deadline without rescheduling or resetting the native timer', async () => {
    mocks.restoreRestNotification.mockResolvedValue({ total: 60, endsAt: 130000 })
    vi.resetModules()
    ;({ useUI } = await import('./useUI.js'))
    await Promise.resolve()
    expect(useUI.getState().timer).toEqual({ total: 60, left: 30, endsAt: 130000 })
    expect(mocks.syncRestNotification).not.toHaveBeenCalled()
    expect(mocks.cancelRestNotification).not.toHaveBeenCalled()
  })

  it('does not overwrite a user-started rest with a delayed cold-launch restoration', async () => {
    let restore
    mocks.restoreRestNotification.mockImplementationOnce(() => new Promise(resolve => { restore = resolve }))
    vi.resetModules()
    ;({ useUI } = await import('./useUI.js'))
    useUI.getState().startRest(90)
    restore({ total: 60, endsAt: 130000 })
    await Promise.resolve()
    expect(useUI.getState().timer.endsAt).toBe(190000)
  })

  it('shares the exact deadline and sound setting; Android never schedules server push', () => {
    useUI.getState().startRest(60)
    const timer = useUI.getState().timer
    expect(timer.endsAt).toBe(160000)
    expect(mocks.syncRestNotification).toHaveBeenCalledWith(timer, true)
    expect(mocks.api).not.toHaveBeenCalled()
  })

  it('uses the deadline after suspension and never resets on visibility changes', () => {
    useUI.getState().startRest(60)
    document.visibilityState = 'hidden'
    vi.setSystemTime(142200) // JS did not tick for 42.2 seconds
    listeners.forEach(fn => fn())
    expect(useUI.getState().timer.left).toBe(18)
    document.visibilityState = 'visible'
    listeners.forEach(fn => fn())
    expect(useUI.getState().timer.endsAt).toBe(160000)
    expect(mocks.syncRestNotification).toHaveBeenCalledTimes(1)
  })

  it('adjusts from the deadline even when the cached in-app count is stale', () => {
    useUI.getState().startRest(60)
    vi.setSystemTime(140000)
    useUI.getState().addRest(15)
    expect(useUI.getState().timer).toEqual({ left: 35, total: 75, endsAt: 175000 })
    expect(mocks.syncRestNotification).toHaveBeenLastCalledWith(useUI.getState().timer, true)
    useUI.getState().addRest(-40)
    expect(useUI.getState().timer).toBeNull()
    expect(mocks.cancelRestNotification).toHaveBeenCalledTimes(1)
  })

  it('replaces previous rest and Skip cancels even when React passes a click event', () => {
    useUI.getState().startRest(60)
    useUI.getState().startRest(30)
    expect(listeners.size).toBe(1)
    expect(mocks.cancelRestNotification).toHaveBeenCalledTimes(1)
    useUI.getState().stopRest({ type: 'click' })
    expect(mocks.cancelRestNotification).toHaveBeenCalledTimes(2)
    expect(useUI.getState().timer).toBeNull()
    expect(listeners.size).toBe(0)
  })

  it('finishes once, preserving the native completion alert without a duplicate local alert', async () => {
    useUI.getState().startRest(2)
    await vi.advanceTimersByTimeAsync(2000)
    expect(useUI.getState().timer).toBeNull()
    expect(mocks.finishRestNotification).toHaveBeenCalledExactlyOnceWith(102000)
    expect(mocks.cancelRestNotification).not.toHaveBeenCalled()
    expect(mocks.vibrate).not.toHaveBeenCalled()
    expect(mocks.beep.mock.calls.filter(call => call[1] === 880)).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(mocks.finishRestNotification).toHaveBeenCalledTimes(1)
  })

  it('keeps in-app completion feedback when notification permission or native calls fail', async () => {
    mocks.finishRestNotification.mockResolvedValue(false)
    useUI.getState().startRest(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(useUI.getState().timer).toBeNull()
    expect(mocks.beep).toHaveBeenCalledTimes(3)
    expect(mocks.vibrate).toHaveBeenCalledTimes(1)
  })

  it('does not repeat the alarm when returning after background expiry', async () => {
    useUI.getState().startRest(60)
    vi.setSystemTime(180000)
    listeners.forEach(fn => fn())
    await Promise.resolve()
    expect(mocks.finishRestNotification).toHaveBeenCalledExactlyOnceWith(160000)
    expect(mocks.beep).not.toHaveBeenCalled()
    expect(useUI.getState().timer).toBeNull()
  })

  it('starting a timed set cancels rest notification', () => {
    useUI.getState().startRest(60)
    useUI.getState().startWork(30, 'Hold', vi.fn())
    expect(mocks.cancelRestNotification).toHaveBeenCalledTimes(1)
    expect(useUI.getState().timer).toBeNull()
  })

  it('preserves browser push and in-app end feedback', async () => {
    mocks.nativeRestSupported.mockReturnValue(false)
    useUI.getState().startRest(1)
    expect(mocks.api).toHaveBeenCalledWith('/api/push/rest-timer', expect.any(Object))
    await vi.advanceTimersByTimeAsync(1000)
    expect(mocks.api).toHaveBeenCalledWith('/api/push/rest-timer/cancel', expect.any(Object))
    expect(mocks.finishRestNotification).not.toHaveBeenCalled()
    expect(mocks.vibrate).toHaveBeenCalledTimes(1)
  })
})
