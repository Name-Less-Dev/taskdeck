import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { parseTheme, resolveTheme } from '../../src/ui/theme.ts'

/**
 * The synchronous theme script in index.html must behave exactly like
 * parseTheme + resolveTheme. It is extracted from the file and run in a
 * sandbox with fake localStorage, matchMedia and <html>.
 */
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''

interface Outcome {
  readonly theme: string | undefined
  readonly choice: string | undefined
}

function boot(stored: string | null | Error, systemDark: boolean | Error): Outcome {
  const attributes = new Map<string, string>()
  const window = {
    localStorage: {
      getItem: (key: string) => {
        if (stored instanceof Error) throw stored
        return key === 'taskdeck:ui:theme' ? stored : null
      },
    },
    matchMedia: (query: string) => {
      if (systemDark instanceof Error) throw systemDark
      return { matches: query === '(prefers-color-scheme: dark)' && systemDark }
    },
  }
  const document = { documentElement: { setAttribute: (name: string, value: string) => attributes.set(name, value) } }
  runInNewContext(script, { window, document })
  return { theme: attributes.get('data-theme'), choice: attributes.get('data-theme-choice') }
}

describe('theme script in index.html', () => {
  it('runs before the stylesheet and the bundle', () => {
    expect(script).toContain('data-theme')
    const scriptAt = html.indexOf('<script>')
    expect(scriptAt).toBeGreaterThan(-1)
    expect(scriptAt).toBeLessThan(html.indexOf('<script type="module"'))
  })

  const stored: (string | null)[] = [
    null,
    '"auto"',
    '"dark"',
    '"light"',
    '"lilac"',
    '"pastel"',
    '"neon"',
    '"Neon"',
    'neon',
    '{"theme":"neon"}',
    '42',
    '',
  ]
  for (const systemDark of [false, true]) {
    it.each(stored)(`stored %j with system dark=${String(systemDark)} matches parseTheme/resolveTheme`, (raw) => {
      let parsed: unknown
      try {
        parsed = raw === null ? null : JSON.parse(raw)
      } catch {
        parsed = null
      }
      const theme = parseTheme(parsed)

      expect(boot(raw, systemDark)).toEqual({ theme: resolveTheme(theme, systemDark), choice: theme })
    })
  }

  it('falls back to auto (light) when storage or matchMedia throw', () => {
    expect(boot(new Error('blocked'), false)).toEqual({ theme: 'light', choice: 'auto' })
    expect(boot('"neon"', new Error('no matchMedia'))).toEqual({ theme: 'neon', choice: 'neon' })
    expect(boot(new Error('blocked'), new Error('no matchMedia'))).toEqual({ theme: 'light', choice: 'auto' })
  })
})
