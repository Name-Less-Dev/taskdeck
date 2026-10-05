import { z } from 'zod'
import {
  adoptOrphans,
  createDeck,
  DeckSchema,
  ensureDeck,
  TaskSchema,
  toDayKey,
  type AppData,
} from '../domain/index.ts'
import { migrate, MIGRATIONS } from './migrations.ts'
import { SCHEMA_VERSION, type RawSnapshot, type StorageContext } from './types.ts'

export const BACKUP_APP = 'taskdeck'

/** File name with the local date, e.g. taskdeck-backup-2026-10-05.json. */
export function backupFileName(now: Date): string {
  return `taskdeck-backup-${toDayKey(now)}.json`
}

/** Backup file: a versioned envelope around decks and tasks, 2-space indented. */
export function serializeBackup(data: AppData, { now }: { now: Date }): string {
  return JSON.stringify(
    { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), decks: data.decks, tasks: data.tasks },
    null,
    2,
  )
}

/**
 * Exports records exactly as they were read, without validation. Used in
 * read-only mode (data from a newer version) so nothing is lost.
 */
export function serializeRawBackup(raw: RawSnapshot, { now }: { now: Date }): string {
  return JSON.stringify(
    {
      app: BACKUP_APP,
      schemaVersion: raw.schemaVersion,
      exportedAt: now.toISOString(),
      decks: raw.decks,
      tasks: raw.tasks,
      meta: raw.meta,
    },
    null,
    2,
  )
}

export type BackupError =
  | { readonly kind: 'invalid-json' }
  | { readonly kind: 'wrong-format' }
  | { readonly kind: 'newer-version'; readonly version: number; readonly supported: number }
  | { readonly kind: 'missing-migration'; readonly version: number }
  /** `path` points at the first invalid field, e.g. "tasks[3].title". */
  | { readonly kind: 'schema'; readonly path: string; readonly code: string }
  | { readonly kind: 'duplicate-ids'; readonly entity: 'deck' | 'task'; readonly ids: readonly string[] }

export type BackupWarning =
  | { readonly kind: 'orphans-recovered'; readonly count: number }
  | { readonly kind: 'default-deck-created' }

export type ParseBackupResult =
  | { readonly ok: true; readonly data: AppData; readonly warnings: readonly BackupWarning[] }
  | { readonly ok: false; readonly error: BackupError }

const EnvelopeSchema = z.object({
  app: z.literal(BACKUP_APP),
  schemaVersion: z.int().min(0),
  decks: z.array(z.unknown()),
  tasks: z.array(z.unknown()),
})

/** ["tasks", 3, "title"] -> "tasks[3].title" */
export function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((out, key) => {
    if (typeof key === 'number') return `${out}[${key}]`
    const name = String(key)
    return out === '' ? name : `${out}.${name}`
  }, '')
}

function firstSchemaError(error: z.ZodError, prefix: string): BackupError {
  const issue = error.issues[0]
  return { kind: 'schema', path: formatPath([prefix, ...(issue?.path ?? [])]), code: issue?.code ?? 'custom' }
}

function duplicateIds(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  return [...new Set(ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false))))]
}

/**
 * Reads a backup file. Pure apart from the injected id factory. Every
 * failure is a distinct structured error; recoverable problems (tasks whose
 * deck is missing, no deck at all) are fixed and reported as warnings.
 */
export function parseBackup(text: string, context: StorageContext): ParseBackupResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: { kind: 'invalid-json' } }
  }

  const envelope = EnvelopeSchema.safeParse(json)
  if (!envelope.success) return { ok: false, error: { kind: 'wrong-format' } }

  const migrated = migrate(
    { schemaVersion: envelope.data.schemaVersion, meta: undefined, decks: envelope.data.decks, tasks: envelope.data.tasks },
    context.migrations ?? MIGRATIONS,
  )
  if (!migrated.ok) {
    return {
      ok: false,
      error:
        migrated.error === 'newer-version'
          ? { kind: 'newer-version', version: migrated.foundVersion, supported: SCHEMA_VERSION }
          : { kind: 'missing-migration', version: migrated.foundVersion },
    }
  }

  const decks = z.array(DeckSchema).safeParse(migrated.snapshot.decks)
  if (!decks.success) return { ok: false, error: firstSchemaError(decks.error, 'decks') }
  const tasks = z.array(TaskSchema).safeParse(migrated.snapshot.tasks)
  if (!tasks.success) return { ok: false, error: firstSchemaError(tasks.error, 'tasks') }

  const deckDuplicates = duplicateIds(decks.data.map((deck) => deck.id))
  if (deckDuplicates.length > 0) return { ok: false, error: { kind: 'duplicate-ids', entity: 'deck', ids: deckDuplicates } }
  const taskDuplicates = duplicateIds(tasks.data.map((task) => task.id))
  if (taskDuplicates.length > 0) return { ok: false, error: { kind: 'duplicate-ids', entity: 'task', ids: taskDuplicates } }

  const warnings: BackupWarning[] = []
  let data: AppData = { decks: decks.data, tasks: tasks.data }

  const deckIds = new Set(data.decks.map((deck) => deck.id))
  if (data.tasks.some((task) => !deckIds.has(task.deckId))) {
    const adopted = adoptOrphans(data, createDeck({ name: context.names.recovered }, { id: context.createId() }))
    data = adopted.data
    warnings.push({ kind: 'orphans-recovered', count: adopted.adopted })
  }
  if (data.decks.length === 0) {
    data = ensureDeck(data, createDeck({ name: context.names.general }, { id: context.createId() })).data
    warnings.push({ kind: 'default-deck-created' })
  }

  return { ok: true, data, warnings }
}
