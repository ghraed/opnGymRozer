import test from 'node:test'
import assert from 'node:assert/strict'
import { activateMemberWithSubscription, createSubscription, financeToday } from '../subscriptions.js'

function fixture({ role = 'trainer', active = true, version = 1, overlap = false, brokenInsert = false, activated = false } = {}) {
  const member = { id: 'member', name: 'Member', role: 'client', activated, disabled: false }
  const actor = { id: 'actor', name: 'Staff', role, disabled: false }
  const plan = { id: 'plan', name: 'Monthly', duration_count: 1, duration_unit: 'month', price: '25.00', currency: 'USD', active, version }
  const input = { id: member.id, planId: plan.id, planVersion: 1, cycle: 'monthly', startsOn: financeToday(), requestKey: 'activation-request-0001' }
  let saved, committed = false, rolledBack = false, updates = 0
  const conn = {
    async beginTransaction() {},
    async execute(sql, values) {
      if (sql.startsWith('SELECT id,role')) return [[actor, member]]
      if (sql.includes('WHERE s.request_key=')) return [[...(saved ? [saved] : [])]]
      if (sql.startsWith('SELECT * FROM membership_plans')) return [[plan]]
      if (sql.startsWith('SELECT id FROM member_subscriptions')) return [overlap ? [{ id: 'existing' }] : []]
      if (sql.startsWith('INSERT INTO member_subscriptions')) {
        if (brokenInsert) throw new Error('Insert failed')
        const [id, member_id, member_name, plan_id, plan_name, cycle, duration_count, duration_unit, starts_on, ends_on, price, currency, notes, request_key, request_hash, created_by] = values
        saved = { id, member_id, member_name, plan_id, plan_name, cycle, duration_count, duration_unit, starts_on, ends_on, price, currency, notes, request_key, request_hash, created_by, version: 1 }
        return [{}]
      }
      if (sql.startsWith('UPDATE users SET activated')) { updates++; member.activated = true; return [{}] }
      if (sql.includes('WHERE s.id=')) return [[saved]]
      throw new Error('Unexpected SQL: ' + sql)
    },
    async commit() { committed = true },
    async rollback() { rolledBack = true },
    release() {},
  }
  return { pool: { async getConnection() { return conn } }, actor, member, input, state: () => ({ saved, committed, rolledBack, updates }) }
}

test('approval assigns coverage and activates together, replaying the same request safely', async () => {
  for (const role of ['trainer', 'admin']) {
    const f = fixture({ role })
    const created = await activateMemberWithSubscription(f.pool, f.actor, f.input)
    assert.equal(created.subscription.memberId, f.member.id)
    assert.equal(created.subscription.price, '25.00')
    assert.equal(created.subscription.startsOn, financeToday())
    assert.equal(f.member.activated, true)
    assert.equal(f.state().committed, true)
    const replay = await activateMemberWithSubscription(f.pool, f.actor, f.input)
    assert.equal(replay.replayed, true)
    assert.equal(replay.subscription.id, created.subscription.id)
    assert.equal(f.state().updates, 1)
  }
})

test('approval cannot activate without a valid plan, matching price version and valid coverage', async () => {
  for (const [options, patch, status] of [
    [{}, { planId: undefined }, 400], [{ active: false }, {}, 409], [{ version: 2 }, {}, 409],
    [{ overlap: true }, {}, 409], [{ activated: true }, {}, 409], [{}, { startsOn: '2020-01-01' }, 409],
    [{}, { cycle: 'yearly' }, 400], [{ role: 'client' }, {}, 403],
  ]) {
    const f = fixture(options)
    await assert.rejects(activateMemberWithSubscription(f.pool, f.actor, { ...f.input, ...patch }), { status })
    assert.equal(f.state().updates, 0)
    assert.equal(f.state().committed, false)
  }
})

test('failed subscription insertion rolls back approval', async () => {
  const f = fixture({ brokenInsert: true })
  await assert.rejects(activateMemberWithSubscription(f.pool, f.actor, f.input), /Insert failed/)
  assert.equal(f.state().rolledBack, true)
  assert.equal(f.member.activated, false)
})

test('trainers still cannot create ordinary renewals', async () => {
  const f = fixture()
  await assert.rejects(createSubscription(f.pool, f.actor, { ...f.input, memberId: f.member.id }), { status: 403 })
  assert.equal(f.state().updates, 0)
})
