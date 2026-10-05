/**
 * The parts of Web Crypto used here. `randomUUID` is optional on purpose: it
 * only exists in secure contexts (HTTPS or localhost), so opening the dev
 * server on a phone at http://192.168.x.x has no randomUUID at all, while
 * getRandomValues works in every context.
 */
type WebCrypto = typeof globalThis.crypto
type IdCrypto = Pick<WebCrypto, 'getRandomValues'> & Partial<Pick<WebCrypto, 'randomUUID'>>

const HEX = Array.from({ length: 256 }, (_, byte) => byte.toString(16).padStart(2, '0'))

function hex(bytes: Uint8Array, from: number, to: number): string {
  let out = ''
  for (let i = from; i < to; i++) out += HEX[bytes[i] ?? 0] ?? '00'
  return out
}

/** RFC 9562 version 4 UUID from 16 cryptographically random bytes. */
function uuidV4From(bytes: Uint8Array): string {
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40 // version 4
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80 // RFC variant (10xx)
  return `${hex(bytes, 0, 4)}-${hex(bytes, 4, 6)}-${hex(bytes, 6, 8)}-${hex(bytes, 8, 10)}-${hex(bytes, 10, 16)}`
}

/**
 * A random UUID v4 for new tasks. Uses crypto.randomUUID when available and
 * falls back to crypto.getRandomValues otherwise. Never Math.random.
 */
export function createId(): string {
  const webCrypto: IdCrypto = globalThis.crypto
  if (typeof webCrypto.randomUUID === 'function') return webCrypto.randomUUID()
  return uuidV4From(webCrypto.getRandomValues(new Uint8Array(16)))
}
