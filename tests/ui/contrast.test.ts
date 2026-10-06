import { describe, expect, it } from 'vitest'
import { TAG_HUES, THEMES } from '../../src/ui/theme.ts'
import { themes, themeTokens } from './theme-tokens.ts'

/**
 * WCAG 2.x contrast, driven by data: every theme block in src/index.css
 * (read straight from the file, so the stylesheet cannot drift) against
 * every pair the UI uses. Text needs 4.5:1 (AA); focus indicators and
 * interface components need 3:1 (WCAG 1.4.11).
 */

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r = 0, g = 0, b = 0] = channels.map((c) => (c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

const RESOLVED = THEMES.filter((theme) => theme !== 'auto')

/** Text on its background (4.5:1). */
const TEXT_PAIRS: readonly [fg: string, bg: string][] = [
  // Page text on backgrounds and surfaces.
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surface-raised'],
  ['text-muted', 'bg'],
  ['text-muted', 'surface'],
  ['text-muted', 'surface-raised'],
  // Primary button and selected toggles.
  ['on-accent', 'accent'],
  // Semantic badges (overdue, soon, info, neutral, muted).
  ['danger-fg', 'danger-bg'],
  ['danger-fg', 'surface'],
  ['warning-fg', 'warning-bg'],
  ['warning-fg', 'surface-raised'],
  ['info-fg', 'info-bg'],
  ['neutral-fg', 'neutral-bg'],
  ['muted-fg', 'muted-bg'],
  // Swipe overlays: complete, postpone, delete.
  ['on-overlay', 'complete'],
  ['on-overlay', 'postpone'],
  ['on-overlay', 'remove'],
  // Escalated cards (overdue / soon): every text colour used on a card face.
  ['text', 'danger-surface'],
  ['text-muted', 'danger-surface'],
  ['danger-fg', 'danger-surface'],
  ['text', 'warning-surface'],
  ['text-muted', 'warning-surface'],
  ['warning-fg', 'warning-surface'],
  ['danger-fg', 'warning-surface'],
]

/** Focus indicators and interface components (3:1, WCAG 1.4.11). */
const UI_PAIRS: readonly [fg: string, bg: string][] = [
  ['focus', 'bg'],
  ['focus', 'surface'],
  ['focus', 'surface-raised'],
  // Selected toggles, checked radios and the primary button against the page.
  ['accent', 'bg'],
  ['accent', 'surface'],
]

const COMMON_TOKENS = [...themeTokens('light').keys()]

describe.each(RESOLVED)('theme "%s"', (theme) => {
  const palette = themeTokens(theme)
  function color(name: string): string {
    const value = palette.get(`color-${name}`)
    if (value === undefined) throw new Error(`missing token --color-${name} in ${theme}`)
    return value
  }

  it('defines every colour token and its color-scheme in its own block', () => {
    expect(COMMON_TOKENS.filter((token) => !palette.has(token))).toEqual([])
    expect(themes.get(theme)?.colorScheme).toMatch(/^(light|dark)$/)
  })

  it.each(TEXT_PAIRS)('%s on %s meets AA for text (4.5:1)', (fg, bg) => {
    expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(UI_PAIRS)('%s on %s meets 3:1 for focus and components', (fg, bg) => {
    expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(3)
  })
})

describe('pastel tag and badge hues', () => {
  const pastel = themeTokens('pastel')

  it.each(Array.from({ length: TAG_HUES }, (_, hue) => hue))('hue %i with its text meets AA (4.5:1)', (hue) => {
    const background = pastel.get(`color-tag-${String(hue)}`)
    const text = pastel.get('color-tag-fg')
    if (background === undefined || text === undefined) throw new Error(`missing pastel tag hue ${String(hue)}`)

    expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('light and dark keep the colours from before themes', () => {
  // The values of the previous :root and prefers-color-scheme: dark blocks.
  const BEFORE = {
    light: { bg: '#f4f1ec', surface: '#ffffff', text: '#1d1b19', 'text-muted': '#5c5650', accent: '#3346c9', 'danger-fg': '#9b1c13', complete: '#1d7238' },
    dark: { bg: '#141312', surface: '#22201e', text: '#f2eee9', 'text-muted': '#b5ada4', accent: '#9eacff', 'danger-fg': '#ffb4ab', complete: '#1d7238' },
  } as const

  it.each(['light', 'dark'] as const)('%s is unchanged', (theme) => {
    const palette = themeTokens(theme)
    for (const [name, value] of Object.entries(BEFORE[theme])) expect(palette.get(`color-${name}`)).toBe(value)
    expect(themes.get(theme)?.colorScheme).toBe(theme)
  })
})

describe('contrast helper', () => {
  it('matches the WCAG reference values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })
})
