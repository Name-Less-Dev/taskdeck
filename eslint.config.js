import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Pure layers: the domain and the calendar export (no DOM, clock or randomness).
const domainFiles = ['src/domain/**/*.ts', 'src/calendar/**/*.ts']

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results']),
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // A "!" must be justified: disable it on the line with a "-- reason" comment.
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // randomUUID throws in insecure contexts (http://192.168.x.x on a phone).
      'no-restricted-properties': [
        'error',
        {
          object: 'crypto',
          property: 'randomUUID',
          message: 'Use createId() from src/lib/id.ts: randomUUID only exists in secure contexts.',
        },
      ],
    },
  },
  {
    files: ['src/lib/id.ts', 'tests/lib/id.test.ts'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
  {
    files: ['eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['vite.config.ts', 'pwa-assets.config.ts', 'playwright.config.ts', 'tests/**/*.ts', 'e2e/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Architecture rule: the domain is pure. No UI framework, no DOM or storage
    // APIs, and no hidden sources of time or randomness (they are injected).
    files: domainFiles,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
              message: 'src/domain must not depend on React.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'localStorage',
          'sessionStorage',
          'indexedDB',
          'caches',
          'fetch',
          'crypto',
          'process',
          'self',
          'globalThis',
        ].map((name) => ({
          name,
          message: `src/domain must not use the "${name}" global (no DOM, storage or environment access).`,
        })),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'NewExpression[callee.name="Date"][arguments.length=0]',
          message: 'Inject "now: Date" instead of calling new Date() without arguments.',
        },
        {
          selector: 'CallExpression[callee.name="Date"]',
          message: 'Date() returns the current time as a string; inject "now: Date" instead.',
        },
        {
          selector: 'MemberExpression[object.name="Date"][property.name="now"]',
          message: 'Inject "now: Date" instead of calling Date.now().',
        },
        {
          selector: 'MemberExpression[object.name="Math"][property.name="random"]',
          message: 'The domain must be deterministic; inject ids or random values.',
        },
        {
          selector: 'MemberExpression[property.name="randomUUID"]',
          message: 'Inject ids instead of generating them in the domain.',
        },
      ],
    },
  },
])
