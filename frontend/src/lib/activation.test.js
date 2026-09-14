import { describe, it, expect } from 'vitest'
import { needsActivation } from './activation.js'

describe('client activation', () => {
  it('requires explicit approval for clients, including cached users without a status', () => {
    expect(needsActivation({ admin: false, activated: false })).toBe(true)
    expect(needsActivation({ admin: false })).toBe(true)
    expect(needsActivation({ admin: false, activated: true })).toBe(false)
  })
  it('keeps trainer and guest access independent from client approval', () => {
    expect(needsActivation({ admin: true, activated: false })).toBe(false)
    expect(needsActivation(null)).toBe(false)
  })
})
