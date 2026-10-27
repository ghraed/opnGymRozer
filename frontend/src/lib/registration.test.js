import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())

describe('registration without invitation codes', () => {
  it.each([undefined, 'OBSOLETE-CODE'])('sends only account credentials, ignoring an old code argument (%s)', async oldCode => {
    vi.stubGlobal('navigator', { userAgent: 'Test browser' })
    const user = { id: 'member', role: 'client', activated: false }
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user }) })
    vi.stubGlobal('fetch', fetch)
    const { passwordRegister } = await import('./api.js')
    expect(await passwordRegister('Member', 'member@test.local', 'Password2026!', oldCode)).toEqual(user)
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('/api/auth/register')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ name: 'Member', email: 'member@test.local', password: 'Password2026!' })
  })
})
