import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { openDB } from 'idb'
import { vi } from 'vitest'
import type { AppData } from '../../src/domain/index.ts'
import type { Meta, StorageContext } from '../../src/storage/index.ts'
import { makeTask, NOW } from '../domain/fixtures.ts'

export const DB = 'taskdeck-test'

/** A brand-new, empty IndexedDB for each test (fake-indexeddb, in memory). */
export function freshIndexedDb(): void {
  vi.stubGlobal('indexedDB', new IDBFactory())
}

/** Deterministic context: ids gen-1, gen-2, ...; fixed clock; pt-BR deck names. */
export function context(overrides: Partial<StorageContext> = {}): StorageContext & { dbName: string } {
  let next = 0
  return {
    dbName: DB,
    createId: () => {
      next += 1
      return `gen-${next}`
    },
    names: { general: 'Geral', recovered: 'Recuperadas' },
    now: () => NOW,
    ...overrides,
  }
}

export function sampleData(): AppData {
  return {
    decks: [
      { id: 'home', name: 'Casa' },
      { id: 'work', name: 'Trabalho' },
    ],
    tasks: [
      makeTask({ id: 't1', deckId: 'home', title: 'Lavar a roupa', tags: ['casa'] }),
      makeTask({
        id: 't2',
        deckId: 'work',
        title: 'Relatório',
        due: { date: '2026-10-07', time: '09:00' },
        recurrence: { unit: 'week', every: 1, anchor: 'due' },
        postponedDays: 2,
      }),
    ],
  }
}

export const sampleMeta: Meta = {
  schemaVersion: 1,
  settings: { activeDeckId: 'work', language: 'en', alarm: '1h', installHintDismissed: false, tutorialSeen: false },
  lastBackupAt: null,
}

/**
 * Writes raw records straight into the stores, bypassing validation, to
 * simulate data written by an older/newer app or corrupted on disk.
 * The stores must exist already (open the storage once first).
 */
export async function writeRaw(raw: { meta?: unknown; decks?: unknown[]; tasks?: unknown[] }): Promise<void> {
  const db = await openDB(DB, 1)
  const tx = db.transaction(['decks', 'tasks', 'meta'], 'readwrite')
  const requests: Promise<unknown>[] = []
  if (raw.meta !== undefined) requests.push(tx.objectStore('meta').put(raw.meta, 'meta'))
  for (const deck of raw.decks ?? []) requests.push(tx.objectStore('decks').put(deck))
  for (const task of raw.tasks ?? []) requests.push(tx.objectStore('tasks').put(task))
  await Promise.all([...requests, tx.done])
  db.close()
}

/** Everything currently on disk, unvalidated. */
export async function readRaw(): Promise<{ meta: unknown; decks: unknown[]; tasks: unknown[]; quarantine: unknown[] }> {
  const db = await openDB(DB, 1)
  const meta: unknown = await db.get('meta', 'meta')
  const decks: unknown[] = await db.getAll('decks')
  const tasks: unknown[] = await db.getAll('tasks')
  const quarantine: unknown[] = await db.getAll('quarantine')
  db.close()
  return { meta, decks, tasks, quarantine }
}
