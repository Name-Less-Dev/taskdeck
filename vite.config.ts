import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts', 'src/state/**/*.ts', 'src/ui/**/*.{ts,tsx}', 'src/i18n/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        'src/domain/**': { lines: 90 },
        'src/state/**': { lines: 90 },
      },
    },
  },
})
