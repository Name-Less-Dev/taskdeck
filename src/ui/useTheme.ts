import { useEffect, useState } from 'react'
import { parseTheme, resolveTheme, THEME_STORAGE_KEY, type Theme } from './theme.ts'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/** The saved theme; missing, broken or unavailable storage means "auto". */
export function readStoredTheme(): Theme {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    return parseTheme(raw === null ? null : JSON.parse(raw))
  } catch {
    return parseTheme(null)
  }
}

export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme))
  } catch {
    // Not saved: the theme still applies for this session.
  }
}

/**
 * Puts the resolved theme on <html> (data-theme, plus data-theme-choice for
 * "auto") and points every <meta name="theme-color"> at its --color-bg, so
 * the browser bar matches. The manifest's theme_color stays static.
 */
export function applyTheme(theme: Theme, systemPrefersDark: boolean): void {
  const root = document.documentElement
  root.dataset.theme = resolveTheme(theme, systemPrefersDark)
  root.dataset.themeChoice = theme
  const background = getComputedStyle(root).getPropertyValue('--color-bg').trim()
  if (background === '') return
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = background
  }
}

/**
 * The chosen theme and a setter that applies it right away and saves it.
 * "auto" follows the system as it changes (matchMedia change events).
 * The first paint is handled by the script in index.html.
 */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState(readStoredTheme)

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    const apply = () => {
      applyTheme(theme, query.matches)
    }
    apply()
    if (theme !== 'auto') return
    query.addEventListener('change', apply)
    return () => {
      query.removeEventListener('change', apply)
    }
  }, [theme])

  return [
    theme,
    (next: Theme) => {
      storeTheme(next)
      setTheme(next)
    },
  ]
}
