import { afterEach, describe, expect, it } from 'vitest'
import { installErrorOverlay } from './errorOverlay.ts'

function overlay(): HTMLElement | null {
  return document.querySelector('[data-dev-error-overlay]')
}

/** jsdom has no PromiseRejectionEvent constructor; build an equivalent event. */
function rejection(reason: unknown): Event {
  const event = new Event('unhandledrejection')
  Object.defineProperty(event, 'reason', { value: reason })
  return event
}

let uninstall: (() => void) | null = null

afterEach(() => {
  uninstall?.()
  uninstall = null
})

describe('installErrorOverlay', () => {
  it('stays out of the page until something fails', () => {
    uninstall = installErrorOverlay()

    expect(overlay()).toBeNull()
  })

  it('prints uncaught errors on the page, with their location', () => {
    uninstall = installErrorOverlay()

    window.dispatchEvent(
      new ErrorEvent('error', {
        error: new TypeError('crypto.randomUUID is not a function'),
        filename: 'http://192.168.0.5:5173/src/demo/seed.ts',
        lineno: 11,
        colno: 62,
      }),
    )

    expect(overlay()).toHaveAttribute('role', 'alert')
    expect(overlay()).toHaveTextContent('[error] TypeError: crypto.randomUUID is not a function')
    expect(overlay()).toHaveTextContent('src/demo/seed.ts:11:62')
  })

  it('prints unhandled promise rejections, including non-Error reasons', () => {
    uninstall = installErrorOverlay()

    window.dispatchEvent(rejection(new Error('network down')))
    window.dispatchEvent(rejection({ code: 42 }))

    expect(overlay()).toHaveTextContent('[unhandledrejection] Error: network down')
    expect(overlay()).toHaveTextContent('[unhandledrejection] {"code":42}')
  })

  it('treats error text as text, never as HTML', () => {
    uninstall = installErrorOverlay()

    window.dispatchEvent(new ErrorEvent('error', { message: '<img src=x onerror=alert(1)>' }))

    expect(overlay()?.querySelector('img')).toBeNull()
    expect(overlay()).toHaveTextContent('<img src=x onerror=alert(1)>')
  })

  it('can be dismissed and comes back on the next error', () => {
    uninstall = installErrorOverlay()
    window.dispatchEvent(new ErrorEvent('error', { message: 'first' }))

    overlay()?.querySelector('button')?.click()
    expect(overlay()).toBeNull()

    window.dispatchEvent(new ErrorEvent('error', { message: 'second' }))
    expect(overlay()).toHaveTextContent('second')
    expect(overlay()).not.toHaveTextContent('first')
  })

  it('removes its listeners and panel when uninstalled', () => {
    const remove = installErrorOverlay()
    window.dispatchEvent(new ErrorEvent('error', { message: 'before' }))

    remove()
    window.dispatchEvent(new ErrorEvent('error', { message: 'after' }))

    expect(overlay()).toBeNull()
  })
})
