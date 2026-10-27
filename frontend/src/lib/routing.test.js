import { describe, expect, it } from 'vitest'
import { legacyWebPath, legacyAdminPath, legacyRenewalPath } from './routing.js'

describe('legacy route migration', () => {
  it('preserves member selection and query parameters in a normal URL', () => {
    expect(legacyWebPath('#/admin/renewals?member=ua2fQm5wLv19ntmK')).toBe('/admin/renewals?member=ua2fQm5wLv19ntmK')
    expect(legacyWebPath('#/admin?q=a%2Bb&section=members')).toBe('/admin?q=a%2Bb&section=members')
  })
  it('leaves ordinary page anchors alone and rejects external paths', () => {
    for (const hash of ['', '#pricing', '#//example.com/path', '#/\\example.com']) expect(legacyWebPath(hash)).toBe(null)
    expect(legacyWebPath('#/')).toBe('/')
  })
})

describe('admin page paths', () => {
  it('moves each legacy section to its page and preserves search parameters', () => {
    for (const section of ['members', 'activity']) {
      expect(legacyAdminPath(`?section=${section}`)).toBe(`/admin/${section}`)
    }
    expect(legacyAdminPath('?section=members&q=a%2Bb')).toBe('/admin/members?q=a%2Bb')
    expect(legacyAdminPath('?q=Pending')).toBe('/admin/members?q=Pending')
  })
  it('keeps the removed membership section redirected and preserves role boundaries', () => {
    expect(legacyAdminPath('?section=membership', true)).toBe('/admin/renewals')
    expect(legacyAdminPath('?section=membership', false)).toBe('/admin/members')
    expect(legacyAdminPath('?section=unknown')).toBe('/admin')
    expect(legacyAdminPath('')).toBe(null)
  })
  it('moves selected renewal members to paths while retaining unrelated filters', () => {
    expect(legacyRenewalPath('?member=ua2fQm5wLv19ntmK')).toBe('/admin/renewals/ua2fQm5wLv19ntmK')
    expect(legacyRenewalPath('?member=test%2Fid&q=a%2Bb')).toBe('/admin/renewals/test%2Fid?q=a%2Bb')
    expect(legacyRenewalPath('?member=')).toBe('/admin/renewals')
    expect(legacyRenewalPath('?q=member')).toBe(null)
  })
})
