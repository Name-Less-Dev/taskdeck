import { z } from 'zod'
import type { AppData } from '../domain/index.ts'
import type { MigrationRegistry } from './migrations.ts'

/** Version of the persisted data format (not the IndexedDB structure version). */
export const SCHEMA_VERSION = 1

export const LANGUAGES = ['auto', 'pt-BR', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

export const SettingsSchema = z.object({
  activeDeckId: z.string().min(1).nullable(),
  language: z.enum(LANGUAGES),
})
export type Settings = z.infer<typeof SettingsSchema>

export const MetaSchema = z.object({
  schemaVersion: z.int().min(0),
  settings: SettingsSchema,
  lastBackupAt: z.iso.datetime().nullable(),
})
export type Meta = z.infer<typeof MetaSchema>

export const DEFAULT_META: Meta = {
  schemaVersion: SCHEMA_VERSION,
  settings: { activeDeckId: null, language: 'auto' },
  lastBackupAt: null,
}

/** Raw records as read from storage, before migration and validation. */
export interface RawSnapshot {
  /** null when there is no readable meta record (fresh database or lost meta). */
  readonly schemaVersion: number | null
  readonly meta: unknown
  readonly decks: readonly unknown[]
  readonly tasks: readonly unknown[]
}

/** A record that failed validation, kept aside instead of being dropped. */
export interface QuarantineEntry {
  readonly store: 'decks' | 'tasks' | 'meta'
  readonly record: unknown
  /** Human-readable summary of the schema issues (developer text, not UI). */
  readonly error: string
  readonly quarantinedAt: string
}

/** Localized names for the decks storage may have to create while repairing data. */
export interface DeckNames {
  readonly general: string
  readonly recovered: string
}

export type LoadResult =
  | {
      readonly ok: true
      readonly data: AppData
      readonly meta: Meta
      /** Nothing was ever saved: offer sample tasks, write nothing yet. */
      readonly firstRun: boolean
      /** Records moved to quarantine by this load. */
      readonly quarantined: number
      /** Records in quarantine overall (this and earlier loads). */
      readonly quarantineTotal: number
      /** Tasks moved into the recovery deck because their deck was missing. */
      readonly recovered: number
      readonly createdDefaultDeck: boolean
    }
  | {
      readonly ok: false
      /** newer-version: written by a newer app; missing-migration: no path from an old version. */
      readonly error: 'newer-version' | 'missing-migration'
      readonly foundVersion: number
      readonly supportedVersion: number
      /** Whatever could be read, untouched, so it can still be exported. */
      readonly raw: RawSnapshot
    }

/**
 * Asynchronous persistence boundary. Named AppStorage (not Storage) so it
 * does not shadow the DOM's global Storage type (localStorage).
 */
export interface AppStorage {
  readonly kind: 'indexeddb' | 'memory'
  load(): Promise<LoadResult>
  /** Writes the whole snapshot atomically: all of it or none of it. */
  save(data: AppData, meta: Meta): Promise<void>
  clear(): Promise<void>
}

export interface StorageContext {
  readonly createId: () => string
  readonly names: DeckNames
  readonly now?: () => Date
  /** Migration steps; defaults to the app's registry (injectable for tests). */
  readonly migrations?: MigrationRegistry
}

/** Raised by save() after a load found data this version must not overwrite. */
export class ReadOnlyStorageError extends Error {
  constructor() {
    super('storage is read-only: it holds data from a newer or unsupported version')
    this.name = 'ReadOnlyStorageError'
  }
}
