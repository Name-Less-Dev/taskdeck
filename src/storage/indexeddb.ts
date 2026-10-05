import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
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

export const DB_NAME = 'taskdeck'
/** IndexedDB structure version (stores), independent from the data SCHEMA_VERSION. */
export const DB_VERSION = 1
const META_KEY = 'meta'
const OPEN_TIMEOUT_MS = 5000

interface TaskdeckDB extends DBSchema {
  // Values are `unknown` on purpose: whatever is on disk is validated on load.
  decks: { key: string; value: unknown }
  tasks: { key: string; value: unknown }
  meta: { key: string; value: unknown }
  quarantine: { key: number; value: QuarantineEntry }
}

type Database = IDBPDatabase<TaskdeckDB>

export interface IndexedDbOptions extends StorageContext {
  readonly dbName?: string
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`IndexedDB did not open within ${ms} ms`))
    }, ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

/** Writes the snapshot (and optional quarantine entries) in one readwrite transaction. */
async function writeSnapshot(
  db: Database,
  data: AppData,
  meta: Meta,
  quarantine: readonly QuarantineEntry[] = [],
): Promise<void> {
  const tx = db.transaction(['decks', 'tasks', 'meta', 'quarantine'], 'readwrite')
  const done = tx.done
  const requests: Promise<unknown>[] = []
  try {
    const decks = tx.objectStore('decks')
    const tasks = tx.objectStore('tasks')
    // Every request is queued synchronously; nothing else is awaited while the
    // transaction is open, so it cannot auto-commit half way.
    requests.push(decks.clear(), tasks.clear())
    for (const deck of data.decks) requests.push(decks.put(deck))
    for (const task of data.tasks) requests.push(tasks.put(task))
    requests.push(tx.objectStore('meta').put(meta, META_KEY))
    for (const entry of quarantine) requests.push(tx.objectStore('quarantine').add(entry))
    await Promise.all([...requests, done])
  } catch (error) {
    // A request that throws synchronously (e.g. DataCloneError) leaves the
    // transaction open: abort it so none of the earlier writes are committed.
    try {
      tx.abort()
    } catch {
      // Already finished or aborted.
    }
    // The requests queued before the failure now reject with AbortError;
    // observe them so they do not surface as unhandled rejections.
    await Promise.allSettled([...requests, done])
    throw error
  }
}

/** Opens (or creates) the database. Rejects when IndexedDB is missing, blocked or failing. */
export async function createIndexedDbStorage(options: IndexedDbOptions): Promise<AppStorage> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not available')

  const db: Database = await withTimeout(
    openDB<TaskdeckDB>(options.dbName ?? DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          database.createObjectStore('decks', { keyPath: 'id' })
          database.createObjectStore('tasks', { keyPath: 'id' })
          database.createObjectStore('meta')
          database.createObjectStore('quarantine', { autoIncrement: true })
        }
      },
      blocking() {
        // Another tab wants to upgrade the structure: let it.
        db.close()
      },
    }),
    OPEN_TIMEOUT_MS,
  )
  let readOnly = false

  return {
    kind: 'indexeddb',

    async load(): Promise<LoadResult> {
      const tx = db.transaction(['decks', 'tasks', 'meta', 'quarantine'], 'readonly')
      const [decks, tasks, meta, quarantineBefore] = await Promise.all([
        tx.objectStore('decks').getAll(),
        tx.objectStore('tasks').getAll(),
        tx.objectStore('meta').get(META_KEY),
        tx.objectStore('quarantine').count(),
        tx.done,
      ])

      const processed = processSnapshot({ schemaVersion: readSchemaVersion(meta), meta, decks, tasks }, options, quarantineBefore)
      if (!processed.result.ok) {
        readOnly = true
        return processed.result
      }
      if (processed.needsWrite) {
        await writeSnapshot(db, processed.result.data, processed.result.meta, processed.quarantine)
      }
      return processed.result
    },

    async save(data: AppData, meta: Meta): Promise<void> {
      if (readOnly) throw new ReadOnlyStorageError()
      await writeSnapshot(db, data, meta)
    },

    async clear(): Promise<void> {
      if (readOnly) throw new ReadOnlyStorageError()
      const tx = db.transaction(['decks', 'tasks', 'meta', 'quarantine'], 'readwrite')
      await Promise.all([
        tx.objectStore('decks').clear(),
        tx.objectStore('tasks').clear(),
        tx.objectStore('meta').clear(),
        tx.objectStore('quarantine').clear(),
        tx.done,
      ])
    },
  }
}
