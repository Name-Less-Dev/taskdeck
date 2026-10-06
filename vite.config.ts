import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
