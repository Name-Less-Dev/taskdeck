import { createIndexedDbStorage, type IndexedDbOptions } from './indexeddb.ts'
import { createMemoryStorage } from './memory.ts'
import type { AppStorage } from './types.ts'

export interface OpenedStorage {
  readonly storage: AppStorage
  /** "memory" means nothing survives a reload: the UI must say so. */
  readonly mode: 'indexeddb' | 'memory'
  /** Why IndexedDB could not be used (developer text), when mode is "memory". */
  readonly fallbackReason: string | null
}

/**
 * Prefers IndexedDB and falls back to memory when it cannot be opened
 * (private mode, blocked by settings, quota, missing API or a hung open).
 */
export async function openStorage(options: IndexedDbOptions): Promise<OpenedStorage> {
  try {
    return { storage: await createIndexedDbStorage(options), mode: 'indexeddb', fallbackReason: null }
  } catch (error) {
    return {
      storage: createMemoryStorage(options),
      mode: 'memory',
      fallbackReason: error instanceof Error ? error.message : String(error),
    }
  }
}
