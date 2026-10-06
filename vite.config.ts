import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

/** A colour token from src/index.css (light theme), so the manifest follows the design. */
function token(name: string): string {
  const css = readFileSync(new URL('./src/index.css', import.meta.url), 'utf8')
  const value = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css)?.[1]
  if (value === undefined) throw new Error(`Missing token --${name} in src/index.css`)
  return value
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // https://vite-pwa-org.netlify.app/guide/ (v2: Vite 3-8, Workbox 7). The service
    // worker exists only in the production build (devOptions stay off).
    VitePWA({
      // A new version waits for "Update" (src/pwa/PwaProvider.tsx); never auto-reload.
      registerType: 'prompt',
      // Registered from React (virtual:pwa-register/react), not by an injected script.
      injectRegister: false,
      manifest: {
        name: 'taskdeck',
        short_name: 'taskdeck',
        description: 'Suas tarefas como um baralho: uma carta por vez, deslize para concluir ou adiar.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: token('color-bg'),
        theme_color: token('color-bg'),
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Default is js/css/html only; the icons are needed offline too.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // Any navigation (e.g. /?lang=en) opens the cached app shell.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    globalSetup: ['./tests/global-setup.ts'],
    projects: [
      {
        // Pure logic (domain, state, gestures, i18n): plain Node, no DOM.
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
        },
      },
      {
        // React components and hooks: jsdom + Testing Library.
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: [
        'src/domain/**/*.ts',
        'src/state/**/*.ts',
        'src/storage/**/*.ts',
        'src/calendar/**/*.ts',
        'src/ui/**/*.{ts,tsx}',
        'src/i18n/**/*.{ts,tsx}',
        'src/components/**/*.tsx',
        'src/dev/**/*.ts',
        'src/lib/**/*.ts',
        'src/App.tsx',
      ],
      exclude: ['**/*.test.{ts,tsx}', 'src/test/**'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        'src/domain/**': { lines: 90 },
        'src/state/**': { lines: 90 },
        'src/storage/**': { lines: 90 },
        'src/calendar/**': { lines: 90 },
      },
    },
  },
})
