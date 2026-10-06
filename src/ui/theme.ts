/** What the user picks in Settings > Appearance. */
export const THEMES = ['auto', 'dark', 'light', 'lilac', 'pastel', 'neon'] as const
export type Theme = (typeof THEMES)[number]

/** A theme with colours: what data-theme on <html> holds ("auto" resolved). */
export type ResolvedTheme = Exclude<Theme, 'auto'>

export const DEFAULT_THEME: Theme = 'auto'

/** localStorage key; the value is JSON (a string). Never in IndexedDB or backups. */
export const THEME_STORAGE_KEY = 'taskdeck:ui:theme'

/** Number of fixed pastel hues for tags and badges ([data-tag-hue] in index.css). */
export const TAG_HUES = 6

/** Anything stored (or missing, or broken) becomes a valid theme; never throws. */
export function parseTheme(raw: unknown): Theme {
  return THEMES.find((theme) => theme === raw) ?? DEFAULT_THEME
}

/** "auto" follows the system; every other theme is itself. */
export function resolveTheme(theme: Theme, systemPrefersDark: boolean): ResolvedTheme {
  if (theme !== 'auto') return theme
  return systemPrefersDark ? 'dark' : 'light'
}

/**
 * Stable pastel hue (0..TAG_HUES-1) for a tag or badge text: FNV-1a over the
 * UTF-16 code units, so the same text always gets the same colour.
 */
export function tagHue(text: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash % TAG_HUES
}
