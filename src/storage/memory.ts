import type { AppData } from '../domain/index.ts'
import { processSnapshot, readSchemaVersion } from './snapshot.ts'
import {
  ReadOnlyStorageError,
  type AppStorage,
  type LoadResult,
  type Meta,
  type QuarantineEntry,
  type StorageContext,
} from './types.ts'

/** Initial raw contents, possibly invalid, to exercise the same load path as IndexedDB. */
export interface MemorySeed {
  readonly meta?: unknown
  readonly decks?: readonly unknown[]
  readonly tasks?: readonly unknown[]
}

export interface MemoryStorage extends AppStorage {
  /** Copy of what is stored, for tests and for the "data is not saved" fallback. */
  snapshot(): { meta: unknown; decks: unknown[]; tasks: unknown[]; quarantine: QuarantineEntry[] }
}

/**
 * Same interface and load rules as the IndexedDB storage, kept in memory.
 * Used when IndexedDB cannot be opened (private mode, blocked, quota) and in
 * tests. Values are cloned on the way in and out, like IndexedDB does.
 */
export function createMemoryStorage(context: StorageContext, seed: MemorySeed = {}): MemoryStorage {
  let meta: unknown = structuredClone(seed.meta)
  let decks: unknown[] = structuredClone([...(seed.decks ?? [])])
  let tasks: unknown[] = structuredClone([...(seed.tasks ?? [])])
  let quarantine: QuarantineEntry[] = []
  let readOnly = false

  function write(data: AppData, nextMeta: Meta) {
    // structuredClone throws on non-cloneable values before anything changes,
    // which gives the same all-or-nothing behaviour as a transaction.
    const next = structuredClone({ decks: data.decks, tasks: data.tasks, meta: nextMeta })
    decks = [...next.decks]
    tasks = [...next.tasks]
    meta = next.meta
  }

  return {
    kind: 'memory',

    load(): Promise<LoadResult> {
      const processed = processSnapshot(
        { schemaVersion: readSchemaVersion(meta), meta, decks, tasks },
        context,
        quarantine.length,
      )
      if (!processed.result.ok) {
        readOnly = true
        return Promise.resolve(processed.result)
      }
      if (processed.needsWrite) {
        write(processed.result.data, processed.result.meta)
        quarantine = [...quarantine, ...structuredClone(processed.quarantine)]
      }
      return Promise.resolve(processed.result)
    },

    save(data: AppData, nextMeta: Meta): Promise<void> {
      if (readOnly) return Promise.reject(new ReadOnlyStorageError())
      try {
        write(data, nextMeta)
        return Promise.resolve()
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)))
      }
    },

    clear(): Promise<void> {
      if (readOnly) return Promise.reject(new ReadOnlyStorageError())
      meta = undefined
      decks = []
      tasks = []
      quarantine = []
      return Promise.resolve()
    },

    snapshot() {
      return structuredClone({ meta, decks, tasks, quarantine })
    },
  }
}
