import { defineConfig, devices } from '@playwright/test'

// End-to-end tests against the production build (vite build + vite preview),
// so the service worker and the manifest are the real ones.
// https://playwright.dev/docs/test-configuration
const PORT = 4173
const BASE_URL = `http://localhost:${String(PORT)}`
const CI = process.env.CI !== undefined

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  ...(CI ? { workers: 1 } : {}),
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    serviceWorkers: 'allow',
    trace: 'on-first-retry',
    // Portuguese UI and a fixed zone, whatever the machine running the tests.
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // "Pixel 7" exists in the installed @playwright/test 1.63 device list.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${String(PORT)} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
})
