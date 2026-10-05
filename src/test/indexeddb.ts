import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { vi } from 'vitest'

/**
 * Gives the test a brand-new, empty fake IndexedDB. Keep the returned
 * factory to "reload the page" on the same database: just render again
 * without calling this.
 */
export function freshIndexedDb(): IDBFactory {
  const factory = new IDBFactory()
  vi.stubGlobal('indexedDB', factory)
  return factory
}
