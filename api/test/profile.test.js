import test from 'node:test'
import assert from 'node:assert/strict'
import { profileComplete } from '../profile.js'

test('profile validation requires all measurements and training preferences', () => {
  const valid = { goal: 'muscle', currentWeight: 80, height: 175, days: 3, experience: 'beginner', equipment: 'full_gym', body: 'none', completedAt: 123 }
  assert.equal(profileComplete(valid), true)
  for (const field of Object.keys(valid)) {
    for (const value of [undefined, null, '', false, {}, []]) {
      const profile = { ...valid, [field]: value }
      assert.equal(profileComplete(profile), false, field)
    }
  }
})

test('optional sex and program choices are validated without locking out older profiles', () => {
  const valid = { goal: 'muscle', currentWeight: 80, height: 175, days: 3, experience: 'beginner', equipment: 'full_gym', body: 'none', completedAt: 123 }
  assert.equal(profileComplete(valid), true)
  for (const programId of ['full_body', 'upper_lower', 'ppl', 'bro_split', null]) {
    for (const sex of ['male', 'female', 'unspecified']) assert.equal(profileComplete({ ...valid, programId, sex }), true)
  }
  for (const value of ['invalid', false, 1, {}, []]) {
    assert.equal(profileComplete({ ...valid, programId: value }), false)
    assert.equal(profileComplete({ ...valid, sex: value }), false)
  }
})

test('session, recovery and home equipment constraints accept valid optional values', () => {
  const valid = { goal: 'muscle', currentWeight: 80, height: 175, days: 3, experience: 'beginner', equipment: 'full_gym', body: 'none', completedAt: 123 }
  assert.equal(profileComplete({ ...valid, sessionMinutes: 45, recovery: 'limited', hasBench: false, hasPullStation: true }), true)
  for (const [field, values] of Object.entries({ sessionMinutes: [0, 20, 61, true, [60]], recovery: ['bad', true], hasBench: ['true', 1], hasPullStation: ['false', 0] })) {
    for (const value of values) assert.equal(profileComplete({ ...valid, [field]: value }), false, field)
  }
})
