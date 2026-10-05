import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contactDeveloper } from './developer-contact.js'

let page, doc
beforeEach(() => {
  vi.useFakeTimers()
  page = new EventTarget()
  page.location = { href: '' }
  doc = new EventTarget()
  doc.visibilityState = 'visible'
  vi.stubGlobal('window', page)
  vi.stubGlobal('document', doc)
})
afterEach(() => {
  page.dispatchEvent(new Event('pagehide'))
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('developer contact', () => {
  it('tries WhatsApp first, then the dialer if the page remains visible', () => {
    contactDeveloper()
    expect(page.location.href).toBe('whatsapp://send?phone=96171251044')
    vi.advanceTimersByTime(2500)
    expect(page.location.href).toBe('tel:+96171251044')
  })

  it('does not dial after switching to WhatsApp and returning', () => {
    contactDeveloper()
    doc.visibilityState = 'hidden'
    doc.dispatchEvent(new Event('visibilitychange'))
    doc.visibilityState = 'visible'
    vi.advanceTimersByTime(5000)
    expect(page.location.href).toBe('whatsapp://send?phone=96171251044')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels the fallback when the page is left', () => {
    contactDeveloper()
    page.dispatchEvent(new Event('pagehide'))
    vi.advanceTimersByTime(5000)
    expect(page.location.href).toBe('whatsapp://send?phone=96171251044')
  })

  it('keeps only the latest fallback on repeated attempts', () => {
    contactDeveloper()
    vi.advanceTimersByTime(1000)
    contactDeveloper()
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(1500)
    expect(page.location.href).toBe('whatsapp://send?phone=96171251044')
    vi.advanceTimersByTime(1000)
    expect(page.location.href).toBe('tel:+96171251044')
  })

  it('opens the dialer immediately if the WhatsApp launch throws', () => {
    let href = ''
    Object.defineProperty(page.location, 'href', {
      get: () => href,
      set: value => {
        if (value.startsWith('whatsapp:')) throw new Error('Unsupported scheme')
        href = value
      },
    })
    contactDeveloper()
    expect(href).toBe('tel:+96171251044')
    expect(vi.getTimerCount()).toBe(0)
  })
})
