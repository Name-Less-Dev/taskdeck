import { afterEach, describe, expect, it, vi } from 'vitest'
import { createId } from '../../src/lib/id.ts'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

// Captured before any stubbing: the real Web Crypto of the test runtime.
const realCrypto = globalThis.crypto

/** Web Crypto as seen at http://192.168.x.x: getRandomValues but no randomUUID. */
function stubInsecureContext() {
  vi.stubGlobal('crypto', {
    getRandomValues: (array: Uint8Array<ArrayBuffer>) => realCrypto.getRandomValues(array),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createId', () => {
  it('uses crypto.randomUUID when it exists', () => {
    const randomUUID = vi.fn(() => '11111111-2222-4333-8444-555555555555')
    vi.stubGlobal('crypto', { randomUUID, getRandomValues: vi.fn() })

    expect(createId()).toBe('11111111-2222-4333-8444-555555555555')
    expect(randomUUID).toHaveBeenCalledTimes(1)
  })

  it('returns a valid UUID v4 with the real randomUUID', () => {
    expect(createId()).toMatch(UUID_V4)
  })

  it('falls back to getRandomValues when randomUUID is missing (insecure context)', () => {
    stubInsecureContext()
    expect('randomUUID' in globalThis.crypto).toBe(false)

    expect(createId()).toMatch(UUID_V4)
  })

  it('sets the version and variant bits from fixed random bytes', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: <T extends Uint8Array>(array: T) => {
        array.fill(0xff)
        return array
      },
    })

    expect(createId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
  })

  it('never uses Math.random in the fallback', () => {
    stubInsecureContext()
    const random = vi.spyOn(Math, 'random')

    createId()

    expect(random).not.toHaveBeenCalled()
  })

  it('produces 1000 distinct ids in the fallback', () => {
    stubInsecureContext()

    const ids = Array.from({ length: 1000 }, () => createId())

    expect(new Set(ids).size).toBe(1000)
    expect(ids.every((id) => UUID_V4.test(id))).toBe(true)
  })
})
