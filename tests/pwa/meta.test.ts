import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const SITE = 'https://taskdeck-flax.vercel.app'

function meta(attribute: 'name' | 'property', key: string): string | undefined {
  return new RegExp(`<meta ${attribute}="${key}" content="([^"]*)"`).exec(html)?.[1]
}

describe('index.html metadata', () => {
  it('has a Portuguese description, as the default language', () => {
    expect(html).toContain('<html lang="pt-BR">')
    expect(meta('name', 'description')).toMatch(/tarefas/)
  })

  it('has Open Graph tags pointing at the deployed site', () => {
    expect(meta('property', 'og:title')).toBe('taskdeck')
    expect(meta('property', 'og:description')).toBe(meta('name', 'description'))
    expect(meta('property', 'og:type')).toBe('website')
    expect(meta('property', 'og:url')).toBe(`${SITE}/`)
    expect(meta('property', 'og:image')).toBe(`${SITE}/og.png`)
    // The declared size is the real size of public/og.png (PNG IHDR: width, height).
    const png = readFileSync(new URL('../../public/og.png', import.meta.url))
    expect(meta('property', 'og:image:width')).toBe(String(png.readUInt32BE(16)))
    expect(meta('property', 'og:image:height')).toBe(String(png.readUInt32BE(20)))
    expect(meta('property', 'og:image:width')).toBe('893')
    expect(meta('property', 'og:image:height')).toBe('893')
  })

  it('has the matching Twitter card', () => {
    expect(meta('name', 'twitter:card')).toBe('summary_large_image')
    expect(meta('name', 'twitter:title')).toBe(meta('property', 'og:title'))
    expect(meta('name', 'twitter:description')).toBe(meta('property', 'og:description'))
    expect(meta('name', 'twitter:image')).toBe(meta('property', 'og:image'))
  })
})
