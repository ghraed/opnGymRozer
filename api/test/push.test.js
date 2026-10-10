import test from 'node:test'
import assert from 'node:assert/strict'
import { deliverPush, deliverReminder } from '../push.js'

const sub = endpoint => ({ endpoint, keys: {} })

test('push timeouts do not report success or mark a reminder sent', async () => {
  let marked = false
  let logged = false
  const send = () => deliverPush([sub('timeout')], { title: 'Reminder' }, {
    send: async () => { throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }) },
    remove: () => assert.fail('temporary failures must retain the subscription'),
    log: () => { logged = true }
  })
  assert.equal(await send(), 0)
  await deliverReminder(send, () => { marked = true })
  assert.equal(logged, true)
  assert.equal(marked, false)
})

test('expired subscriptions are removed while working subscriptions still receive push', async () => {
  const removed = [], received = []
  const sent = await deliverPush([sub('expired'), sub('working')], { title: 'Test' }, {
    send: async (subscription, payload, options) => {
      assert.equal(options.timeout, 10000)
      if (subscription.endpoint === 'expired') throw { statusCode: 410 }
      received.push(JSON.parse(payload))
    },
    remove: async endpoint => removed.push(endpoint)
  })
  assert.equal(sent, 1)
  assert.deepEqual(removed, ['expired'])
  assert.deepEqual(received, [{ title: 'Test' }])
})

test('a reminder is marked only after the push service accepts it', async () => {
  const events = []
  await deliverReminder(async () => { events.push('accepted'); return 1 }, async () => events.push('marked'))
  assert.deepEqual(events, ['accepted', 'marked'])
})

test('no subscriptions means no successful delivery', async () => {
  assert.equal(await deliverPush([], {}, { send: () => assert.fail(), remove: () => assert.fail() }), 0)
})
