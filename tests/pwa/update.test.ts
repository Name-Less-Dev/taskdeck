import { describe, expect, it } from 'vitest'
import { shouldOfferUpdate } from '../../src/pwa/update.ts'

describe('shouldOfferUpdate', () => {
  it.each([
    [true, false, false, true],
    [true, true, false, false],
    [true, false, true, false],
    [false, false, false, false],
  ])('needRefresh=%s sheetOpen=%s postponed=%s -> %s', (needRefresh, sheetOpen, postponed, expected) => {
    expect(shouldOfferUpdate({ needRefresh, sheetOpen, postponed })).toBe(expected)
  })
})
