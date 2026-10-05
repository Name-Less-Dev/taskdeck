import { z } from 'zod'
import {
  adoptOrphans,
  createDeck,
  DeckSchema,
  ensureDeck,
  TaskSchema,
  type AppData,
  type Deck,
  type Task,
} from '../domain/index.ts'
import { migrate, MIGRATIONS } from './migrations.ts'
import {
  DEFAULT_META,
  MetaSchema,
  SCHEMA_VERSION,
  type LoadResult,
  type Meta,
  type QuarantineEntry,
  type RawSnapshot,
  type StorageContext,
} from './types.ts'

/** Reads `schemaVersion` from an unknown meta record, if it has a sane one. */
export function readSchemaVersion(meta: unknown): number | null {
  if (typeof meta !== 'object' || meta === null || !('schemaVersion' in meta)) return null
  const version = meta.schemaVersion
  return typeof version === 'number' && Number.isInteger(version) && version >= 0 ? version : null
}

function splitValid<T>(
  records: readonly unknown[],
  schema: z.ZodType<T>,
  store: QuarantineEntry['store'],
  quarantinedAt: string,
): { valid: T[]; invalid: QuarantineEntry[] } {
  const valid: T[] = []
  const invalid: QuarantineEntry[] = []
  for (const record of records) {
    const result = schema.safeParse(record)
    if (result.success) valid.push(result.data)
    else invalid.push({ store, record, error: z.prettifyError(result.error), quarantinedAt })
  }
  return { valid, invalid }
}

export interface ProcessedSnapshot {
  readonly result: Extract<LoadResult, { ok: true }> | Extract<LoadResult, { ok: false }>
  /** Records to move to quarantine. */
  readonly quarantine: readonly QuarantineEntry[]
  /** True when storage should be rewritten (migrated, repaired or quarantined). */
  readonly needsWrite: boolean
}

/**
 * Pure core of load(), shared by every storage implementation: migrate,
 * validate each record with the domain schemas, move invalid ones to
 * quarantine, create the default deck if none is left, and move orphan
 * tasks into the recovery deck.
 */
export function processSnapshot(
  raw: RawSnapshot,
  context: StorageContext,
  quarantineBefore = 0,
): ProcessedSnapshot {
  const migrated = migrate(raw, context.migrations ?? MIGRATIONS)
  if (!migrated.ok) {
    return {
      result: {
        ok: false,
        error: migrated.error,
        foundVersion: migrated.foundVersion,
        supportedVersion: SCHEMA_VERSION,
        raw,
      },
      quarantine: [],
      needsWrite: false,
    }
  }

  const snapshot = migrated.snapshot
  const quarantinedAt = (context.now?.() ?? new Date()).toISOString()
  const firstRun = snapshot.meta === undefined && snapshot.decks.length === 0 && snapshot.tasks.length === 0

  const decks = splitValid<Deck>(snapshot.decks, DeckSchema, 'decks', quarantinedAt)
  const tasks = splitValid<Task>(snapshot.tasks, TaskSchema, 'tasks', quarantinedAt)
  const quarantine = [...decks.invalid, ...tasks.invalid]

  let meta: Meta = DEFAULT_META
  if (snapshot.meta !== undefined) {
    const parsed = MetaSchema.safeParse(snapshot.meta)
    if (parsed.success) meta = { ...parsed.data, schemaVersion: SCHEMA_VERSION }
    else quarantine.push({ store: 'meta', record: snapshot.meta, error: z.prettifyError(parsed.error), quarantinedAt })
  }

  let data: AppData = { decks: decks.valid, tasks: tasks.valid }
  let createdDefaultDeck = false
  if (data.decks.length === 0) {
    const ensured = ensureDeck(data, createDeck({ name: context.names.general }, { id: context.createId() }))
    data = ensured.data
    createdDefaultDeck = ensured.created
  }

  const deckIds = new Set(data.decks.map((deck) => deck.id))
  let recovered = 0
  if (data.tasks.some((task) => !deckIds.has(task.deckId))) {
    const recovery = createDeck({ name: context.names.recovered }, { id: context.createId() })
    const adopted = adoptOrphans(data, recovery)
    data = adopted.data
    recovered = adopted.adopted
  }

  // The active deck may have been quarantined or never existed.
  const activeDeckId = meta.settings.activeDeckId
  if (activeDeckId !== null && !data.decks.some((deck) => deck.id === activeDeckId)) {
    meta = { ...meta, settings: { ...meta.settings, activeDeckId: null } }
  }

  return {
    result: {
      ok: true,
      data,
      meta,
      firstRun,
      quarantined: quarantine.length,
      quarantineTotal: quarantineBefore + quarantine.length,
      recovered,
      createdDefaultDeck,
    },
    quarantine,
    needsWrite:
      !firstRun && (quarantine.length > 0 || recovered > 0 || createdDefaultDeck || migrated.migratedFrom !== null),
  }
}
