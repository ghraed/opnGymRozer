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
