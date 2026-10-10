// Success means the push service accepted a message; device delivery is asynchronous.
export async function deliverPush(subscriptions, payload, { send, remove, log = console.error }) {
  let sent = 0
  for (const sub of subscriptions) {
    try {
      await send(sub, JSON.stringify(payload), { urgency: 'high', timeout: 10000 })
      sent++
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) await remove(sub.endpoint)
      else log('push failed', error)
    }
  }
  return sent
}

export async function deliverReminder(send, markSent) {
  if (await send() > 0) await markSent()
}
