import { SCHEMA_VERSION, type RawSnapshot } from './types.ts'

/** Turns a snapshot of version N into version N + 1. Pure. */
export type Migration = (raw: RawSnapshot) => RawSnapshot

/** Migration from each version to the next, keyed by the version it starts from. */
export type MigrationRegistry = Readonly<Partial<Record<number, Migration>>>

/**
 * v1 is the first persisted format, so there is nothing to migrate yet.
 * To ship v2: bump SCHEMA_VERSION and add `1: (raw) => ({ ...raw, ... })`.
 */
export const MIGRATIONS: MigrationRegistry = {}

export type MigrateResult =
  | { readonly ok: true; readonly snapshot: RawSnapshot; readonly migratedFrom: number | null }
  | { readonly ok: false; readonly error: 'newer-version' | 'missing-migration'; readonly foundVersion: number }

/**
 * Brings a raw snapshot up to `target`, one registered step at a time.
 * Never touches data from a newer version. A snapshot without a version
 * (no meta) is treated as current.
 */
export function migrate(
  raw: RawSnapshot,
  registry: MigrationRegistry = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): MigrateResult {
  const found = raw.schemaVersion ?? target
  if (found > target) return { ok: false, error: 'newer-version', foundVersion: found }

  let snapshot = raw
  for (let version = found; version < target; version++) {
    const step = registry[version]
    if (step === undefined) return { ok: false, error: 'missing-migration', foundVersion: found }
    snapshot = { ...step(snapshot), schemaVersion: version + 1 }
  }
  return { ok: true, snapshot: { ...snapshot, schemaVersion: target }, migratedFrom: found === target ? null : found }
}
