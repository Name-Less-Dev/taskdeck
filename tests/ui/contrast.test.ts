import { describe, expect, it } from 'vitest'
import { themeTokens } from './theme-tokens.ts'

/**
 * Checks WCAG 2.x contrast for every token pair the UI puts text on, in both
 * themes, straight from src/index.css so the stylesheet cannot drift.
 */

const light = themeTokens('light')
const dark = themeTokens('dark')

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r = 0, g = 0, b = 0] = channels.map((c) => (c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

const TEXT_PAIRS: readonly [fg: string, bg: string][] = [
  ['text', 'surface'],
  ['text', 'bg'],
  ['text-muted', 'surface'],
  ['text-muted', 'bg'],
  ['text-muted', 'surface-raised'],
  ['danger-fg', 'danger-bg'],
  ['danger-fg', 'surface'],
  ['warning-fg', 'warning-bg'],
  ['warning-fg', 'surface-raised'],
  ['info-fg', 'info-bg'],
  ['neutral-fg', 'neutral-bg'],
  ['muted-fg', 'muted-bg'],
  ['on-overlay', 'complete'],
  ['on-overlay', 'postpone'],
  ['on-overlay', 'remove'],
  ['on-accent', 'accent'],
  // Escalated cards (overdue / soon): every text colour used on a card face.
  ['text', 'danger-surface'],
  ['text-muted', 'danger-surface'],
  ['danger-fg', 'danger-surface'],
  ['text', 'warning-surface'],
  ['text-muted', 'warning-surface'],
  ['warning-fg', 'warning-surface'],
  ['danger-fg', 'warning-surface'],
]

// Non-text UI (focus ring) only needs 3:1 against what surrounds it.
const UI_PAIRS: readonly [fg: string, bg: string][] = [
  ['focus', 'surface'],
  ['focus', 'bg'],
]

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (_theme, palette) => {
  function color(name: string): string {
    const value = palette.get(`color-${name}`)
    if (value === undefined) throw new Error(`missing token --color-${name}`)
    return value
  }

  it.each(TEXT_PAIRS)('%s on %s meets AA for text (4.5:1)', (fg, bg) => {
    expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(UI_PAIRS)('%s on %s meets AA for UI components (3:1)', (fg, bg) => {
    expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(3)
  })
})

describe('contrast helper', () => {
  it('matches the WCAG reference values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })
})
