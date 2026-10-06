import { readFileSync } from 'node:fs'

/**
 * Reads the colour tokens of every theme straight from src/index.css, so the
 * tests cannot drift from the stylesheet. A theme block is a rule whose whole
 * selector is [data-theme='x'] (optionally preceded by ":root,").
 */
export const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8')

const THEME_SELECTOR = /^(?::root,\s*)?\[data-theme='([\w-]+)'\]$/

function colorTokens(body: string): Map<string, string> {
  return new Map([...body.matchAll(/--(color-[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1] ?? '', m[2] ?? '']))
}

function readThemes(): Map<string, { readonly tokens: Map<string, string>; readonly colorScheme: string | undefined }> {
  const themes = new Map<string, { tokens: Map<string, string>; colorScheme: string | undefined }>()
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (match[1] ?? '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim()
    const theme = THEME_SELECTOR.exec(selector)?.[1]
    if (theme === undefined) continue
    const body = match[2] ?? ''
    themes.set(theme, { tokens: colorTokens(body), colorScheme: /color-scheme:\s*([\w ]+);/.exec(body)?.[1] })
  }
  return themes
}

export const themes = readThemes()

/** The tokens of one theme; throws if the theme block is missing. */
export function themeTokens(theme: string): Map<string, string> {
  const found = themes.get(theme)
  if (found === undefined) throw new Error(`missing [data-theme='${theme}'] block in src/index.css`)
  return found.tokens
}
