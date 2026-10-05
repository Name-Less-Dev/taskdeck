import { vi } from 'vitest'
import type { AppProps } from '../App.tsx'
import type { AppData } from '../domain/index.ts'
import { createMemoryStorage, DEFAULT_META, type Meta } from '../storage/index.ts'
import type { PersistenceApi } from '../ui/usePersistence.ts'

/** Persistence API that never touches navigator (jsdom has no StorageManager). */
export function fakePersistence(persisted = false): PersistenceApi {
  return {
    get: vi.fn(() => Promise.resolve({ supported: true, persisted })),
    request: vi.fn(() => Promise.resolve({ supported: true, persisted: true })),
  }
}

/** Every required App prop, with an in-memory storage, for component tests. */
export function appProps(initialData: AppData, overrides: Partial<AppProps> = {}): AppProps {
  let next = 0
  const meta: Meta = DEFAULT_META
  return {
    initialData,
    initialMeta: meta,
    storage: createMemoryStorage({
      createId: () => `mem-${String(++next)}`,
      names: { general: 'Geral', recovered: 'Recuperadas' },
    }),
    storageMode: 'indexeddb',
    language: 'auto',
    onLanguageChange: vi.fn(),
    persistence: fakePersistence(),
    download: vi.fn(),
    ...overrides,
  }
}
