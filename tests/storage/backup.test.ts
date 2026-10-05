import { describe, expect, it } from 'vitest'
import {
  backupFileName,
  formatPath,
  parseBackup,
  serializeBackup,
  serializeRawBackup,
  type BackupError,
} from '../../src/storage/backup.ts'
import { makeTask, NOW } from '../domain/fixtures.ts'
import { context, sampleData } from './helpers.ts'

function envelope(overrides: Record<string, unknown> = {}): string {
  const { decks, tasks } = sampleData()
  return JSON.stringify({ app: 'taskdeck', schemaVersion: 1, exportedAt: NOW.toISOString(), decks, tasks, ...overrides })
}

function errorOf(text: string): BackupError | null {
  const result = parseBackup(text, context())
  return result.ok ? null : result.error
}

describe('serializeBackup', () => {
  it('writes the versioned envelope with 2-space indentation', () => {
    const text = serializeBackup(sampleData(), { now: NOW })

    expect(JSON.parse(text)).toEqual({
      app: 'taskdeck',
      schemaVersion: 1,
      exportedAt: NOW.toISOString(),
      ...sampleData(),
    })
    expect(text).toContain('\n  "app": "taskdeck"')
  })

  it('names the file with the local date', () => {
    expect(backupFileName(new Date(2026, 9, 5, 23, 59))).toBe('taskdeck-backup-2026-10-05.json')
  })
})

describe('parseBackup', () => {
  it('round-trips an export exactly', () => {
    const result = parseBackup(serializeBackup(sampleData(), { now: NOW }), context())

    expect(result).toEqual({ ok: true, data: sampleData(), warnings: [] })
  })

  it.each<[string, string, BackupError]>([
    ['not JSON', '{ nope', { kind: 'invalid-json' }],
    ['an empty file', '', { kind: 'invalid-json' }],
    ['JSON from another app', JSON.stringify({ app: 'other', schemaVersion: 1, decks: [], tasks: [] }), { kind: 'wrong-format' }],
    ['a JSON array', '[]', { kind: 'wrong-format' }],
    ['missing tasks', JSON.stringify({ app: 'taskdeck', schemaVersion: 1, decks: [] }), { kind: 'wrong-format' }],
    ['a newer version', envelope({ schemaVersion: 2 }), { kind: 'newer-version', version: 2, supported: 1 }],
    ['an unknown old version', envelope({ schemaVersion: 0 }), { kind: 'missing-migration', version: 0 }],
  ])('rejects %s', (_label, text, expected) => {
    expect(errorOf(text)).toEqual(expected)
  })

  it('reports the path of the first invalid field', () => {
    const tasks = [makeTask({ id: 'a', deckId: 'home' }), { ...makeTask({ id: 'b', deckId: 'home' }), title: '' }]

    expect(errorOf(envelope({ tasks }))).toEqual({ kind: 'schema', path: 'tasks[1].title', code: 'too_small' })
    expect(errorOf(envelope({ decks: [{ id: 'd', name: 42 }] }))).toEqual({
      kind: 'schema',
      path: 'decks[0].name',
      code: 'invalid_type',
    })
  })

  it.each([
    ['decks', { decks: [{ id: 'd', name: 'A' }, { id: 'd', name: 'B' }], tasks: [] }, 'deck'],
    [
      'tasks',
      { decks: [{ id: 'd', name: 'A' }], tasks: [makeTask({ id: 'x', deckId: 'd' }), makeTask({ id: 'x', deckId: 'd' })] },
      'task',
    ],
  ] as const)('rejects duplicate ids in %s', (_label, body, entity) => {
    expect(errorOf(envelope(body))).toEqual({ kind: 'duplicate-ids', entity, ids: [entity === 'deck' ? 'd' : 'x'] })
  })

  it('moves tasks whose deck is missing into "Recuperadas" and warns with the count', () => {
    const tasks = [makeTask({ id: 'a', deckId: 'home' }), makeTask({ id: 'b', deckId: 'gone' }), makeTask({ id: 'c', deckId: 'gone' })]

    const result = parseBackup(envelope({ tasks }), context())

    expect(result.ok && result.warnings).toEqual([{ kind: 'orphans-recovered', count: 2 }])
    expect(result.ok && result.data.decks.at(-1)).toEqual({ id: 'gen-1', name: 'Recuperadas' })
    expect(result.ok && result.data.tasks.map((task) => task.deckId)).toEqual(['home', 'gen-1', 'gen-1'])
  })

  it('creates "Geral" when the backup has no deck at all', () => {
    const result = parseBackup(envelope({ decks: [], tasks: [] }), context())

    expect(result).toEqual({
      ok: true,
      data: { decks: [{ id: 'gen-1', name: 'Geral' }], tasks: [] },
      warnings: [{ kind: 'default-deck-created' }],
    })
  })

  it('migrates an old backup through the registry', () => {
    const v0 = JSON.stringify({ app: 'taskdeck', schemaVersion: 0, decks: [{ id: 'd', label: 'Antigo' }], tasks: [] })
    const migrations = {
      0: (raw: { decks: readonly unknown[] }) => ({
        ...raw,
        decks: raw.decks.map((deck) => ({ id: (deck as { id: string }).id, name: (deck as { label: string }).label })),
      }),
    }

    const result = parseBackup(v0, context({ migrations: migrations as never }))

    expect(result).toMatchObject({ ok: true, data: { decks: [{ id: 'd', name: 'Antigo' }] } })
  })
})

describe('serializeRawBackup', () => {
  it('exports unvalidated records untouched, with their own version', () => {
    const raw = { schemaVersion: 7, meta: { future: true }, decks: [{ shape: 'unknown' }], tasks: [1, 2] }

    expect(JSON.parse(serializeRawBackup(raw, { now: NOW }))).toEqual({
      app: 'taskdeck',
      schemaVersion: 7,
      exportedAt: NOW.toISOString(),
      decks: [{ shape: 'unknown' }],
      tasks: [1, 2],
      meta: { future: true },
    })
  })
})

describe('formatPath', () => {
  it.each([
    [['tasks', 3, 'title'], 'tasks[3].title'],
    [['decks'], 'decks'],
    [['tasks', 0, 'due', 'time'], 'tasks[0].due.time'],
  ])('formats %o as %s', (path, expected) => {
    expect(formatPath(path)).toBe(expected)
  })
})
