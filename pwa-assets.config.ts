import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// PNG icons for the manifest and iOS, generated from public/icon.svg with
// `npm run icons` (https://vite-pwa-org.netlify.app/assets-generator/cli).
// The generated files are committed; run it again only when the SVG changes.
const ACCENT = '#3346c9' // --color-accent (light theme)

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // Maskable and Apple icons get a solid background: the accent, so the padding blends in.
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: ACCENT } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: ACCENT } },
  },
  images: ['public/icon.svg'],
})
