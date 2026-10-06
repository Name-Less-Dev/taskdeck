import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { themeTokens } from '../ui/theme-tokens.ts'

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url))
const html = read('index.html').toString('utf8')

/** Width and height from a PNG's IHDR chunk. */
function pngSize(path: string): [number, number] {
  const bytes = read(path)
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG')
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
}

describe('PWA assets', () => {
  it('has theme-color metas for light and dark that match --color-bg', () => {
    // The static metas (before the theme script runs) are the light and dark themes' background.
    const light = themeTokens('light').get('color-bg')
    const dark = themeTokens('dark').get('color-bg')

    expect(light).toBeDefined()
    expect(dark).toBeDefined()
    expect(html).toContain(`<meta name="theme-color" content="${String(light)}" media="(prefers-color-scheme: light)" />`)
    expect(html).toContain(`<meta name="theme-color" content="${String(dark)}" media="(prefers-color-scheme: dark)" />`)
  })

  it.each([
    ['public/pwa-192x192.png', 192],
    ['public/pwa-512x512.png', 512],
    ['public/maskable-icon-512x512.png', 512],
    ['public/apple-touch-icon-180x180.png', 180],
  ])('%s is a %ipx square PNG', (path, size) => {
    expect(pngSize(path)).toEqual([size, size])
  })

  it('links the icons from index.html', () => {
    expect(html).toContain('href="/apple-touch-icon-180x180.png"')
    expect(html).toContain('href="/icon.svg"')
  })
})
