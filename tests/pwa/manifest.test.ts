import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url))
const css = read('src/index.css').toString('utf8')
const html = read('index.html').toString('utf8')

function token(block: string, name: string): string | undefined {
  return new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(block)?.[1]
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(path: string): [number, number] {
  const bytes = read(path)
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG')
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
}

describe('PWA assets', () => {
  it('has theme-color metas for light and dark that match --color-bg', () => {
    const darkBlock = /prefers-color-scheme:\s*dark\)\s*{\s*:root\s*{([^}]*)}/.exec(css)?.[1] ?? ''
    const light = token(css, 'color-bg')
    const dark = token(darkBlock, 'color-bg')

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
