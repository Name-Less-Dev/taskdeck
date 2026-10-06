import { describe, expect, it } from 'vitest'
import { parseTheme, resolveTheme, TAG_HUES, tagHue, THEMES, type Theme } from '../../src/ui/theme.ts'

describe('parseTheme', () => {
  it.each<[unknown, Theme]>([
    ['auto', 'auto'],
    ['dark', 'dark'],
    ['light', 'light'],
    ['lilac', 'lilac'],
    ['pastel', 'pastel'],
    ['neon', 'neon'],
    [null, 'auto'],
    [undefined, 'auto'],
    ['', 'auto'],
    ['Neon', 'auto'],
    ['sepia', 'auto'],
    [42, 'auto'],
    [{ theme: 'neon' }, 'auto'],
    [['neon'], 'auto'],
  ])('%j -> %s', (raw, expected) => {
    expect(parseTheme(raw)).toBe(expected)
  })
})

describe('resolveTheme', () => {
  it.each<[Theme, boolean, string]>([
    ['auto', false, 'light'],
    ['auto', true, 'dark'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['lilac', true, 'lilac'],
    ['pastel', true, 'pastel'],
    ['neon', false, 'neon'],
  ])('%s with system dark=%s -> %s', (theme, systemDark, expected) => {
    expect(resolveTheme(theme, systemDark)).toBe(expected)
  })

  it('never resolves to "auto"', () => {
    for (const theme of THEMES) {
      for (const dark of [true, false]) expect(resolveTheme(theme, dark)).not.toBe('auto')
    }
  })
})

describe('tagHue', () => {
  it('is stable and within the palette', () => {
    for (const tag of ['casa', 'trabalho', 'lazer', 'reunião', '🌱', '']) {
      const hue = tagHue(tag)
      expect(tagHue(tag)).toBe(hue)
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(TAG_HUES)
    }
  })

  it('spreads common tags over several hues', () => {
    const hues = new Set(['casa', 'trabalho', 'lazer', 'mercado', 'saude', 'estudo', 'contas', 'rapida'].map(tagHue))

    expect(hues.size).toBeGreaterThanOrEqual(3)
  })
})
