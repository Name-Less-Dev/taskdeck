import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppData, Task } from '../../src/domain/index.ts'
import {
  createIndexedDbStorage,
  openStorage,
  ReadOnlyStorageError,
  type LoadResult,
  type Migration,
} from '../../src/storage/index.ts'
import { makeTask } from '../domain/fixtures.ts'
import { context, freshIndexedDb, readRaw, sampleData, sampleMeta, writeRaw } from './helpers.ts'

function ready(result: LoadResult): Extract<LoadResult, { ok: true }> {
  if (!result.ok) throw new Error(`expected a successful load, got ${result.error}`)
  return result
}

beforeEach(() => {
  freshIndexedDb()
})

describe('IndexedDB storage: round trip', () => {
  it('loads exactly what was saved, in a new connection', async () => {
    const first = await createIndexedDbStorage(context())
    await first.save(sampleData(), sampleMeta)

    const second = await createIndexedDbStorage(context())
    const loaded = ready(await second.load())

    expect(loaded.data).toEqual(sampleData())
    expect(loaded.meta).toEqual(sampleMeta)
    expect(loaded).toMatchObject({ firstRun: false, quarantined: 0, recovered: 0, createdDefaultDeck: false })
  })

  it('replaces the previous snapshot instead of merging with it', async () => {
    const storage = await createIndexedDbStorage(context())
    await storage.save(sampleData(), sampleMeta)
    const smaller: AppData = { decks: [{ id: 'home', name: 'Casa' }], tasks: [] }

    await storage.save(smaller, sampleMeta)

    expect(ready(await storage.load()).data).toEqual(smaller)
  })

  it('reports a first run on an empty database, with an in-memory "Geral" deck, and writes nothing', async () => {
    const storage = await createIndexedDbStorage(context())

    const loaded = ready(await storage.load())

    expect(loaded.firstRun).toBe(true)
    expect(loaded.data).toEqual({ decks: [{ id: 'gen-1', name: 'Geral' }], tasks: [] })
    expect(await readRaw()).toEqual({ meta: undefined, decks: [], tasks: [], quarantine: [] })
  })

  it('clears every store', async () => {
    const storage = await createIndexedDbStorage(context())
    await storage.save(sampleData(), sampleMeta)

    await storage.clear()

    expect(ready(await storage.load()).firstRun).toBe(true)
  })
})

describe('IndexedDB storage: validation and repair', () => {
  it('moves invalid records to quarantine with the error, and reports the count', async () => {
    const storage = await createIndexedDbStorage(context())
    await storage.save(sampleData(), sampleMeta)
    await writeRaw({
      tasks: [{ id: 'bad-1', deckId: 'home', title: '' }],
      decks: [{ id: 'bad-deck', name: 'x'.repeat(40) }],
    })

    const loaded = ready(await createIndexedDbStorage(context()).then((s) => s.load()))

    expect(loaded.quarantined).toBe(2)
    expect(loaded.quarantineTotal).toBe(2)
    expect(loaded.data).toEqual(sampleData())
    const raw = await readRaw()
    expect(raw.tasks).toHaveLength(2)
    expect(raw.quarantine).toEqual([
      expect.objectContaining({ store: 'decks', record: { id: 'bad-deck', name: 'x'.repeat(40) } }),
      expect.objectContaining({ store: 'tasks', record: { id: 'bad-1', deckId: 'home', title: '' } }),
    ])
    expect((raw.quarantine[1] as { error: string }).error).toMatch(/title/)
  })

  it('keeps counting quarantined records across loads without moving them again', async () => {
    const storage = await createIndexedDbStorage(context())
    await storage.save(sampleData(), sampleMeta)
    await writeRaw({ tasks: [{ nonsense: true, id: 'junk' }] })
    await storage.load()

    const again = ready(await storage.load())

    expect(again).toMatchObject({ quarantined: 0, quarantineTotal: 1 })
  })

  it('creates "Geral" when no valid deck is left', async () => {
    const storage = await createIndexedDbStorage(context())
    await storage.save({ decks: [{ id: 'only', name: 'Única' }], tasks: [] }, sampleMeta)
    await writeRaw({ decks: [{ id: 'only', name: '' }] })

    const loaded = ready(await storage.load())

    expect(loaded.createdDefaultDeck).toBe(true)
    expect(loaded.data.decks).toEqual([{ id: 'gen-1', name: 'Geral' }])
    expect(loaded.meta.settings.activeDeckId).toBeNull()
    expect((await readRaw()).decks).toEqual([{ id: 'gen-1', name: 'Geral' }])
  })

  it('moves orphan tasks into "Recuperadas" and saves the repair', async () => {
    const storage = await createIndexedDbStorage(context())
    await storage.save(sampleData(), sampleMeta)
    await writeRaw({ tasks: [makeTask({ id: 'orphan', deckId: 'deleted-deck' })] })

    const loaded = ready(await storage.load())

    expect(loaded.recovered).toBe(1)
    expect(loaded.data.decks.at(-1)).toEqual({ id: 'gen-1', name: 'Recuperadas' })
    expect(loaded.data.tasks.find((task) => task.id === 'orphan')?.deckId).toBe('gen-1')
    expect((await readRaw()).decks).toHaveLength(3)
  })

  it('falls back to default settings when the meta record is invalid', async () => {
    const storage = await createIndexedDbStorage(context())
    await storage.save(sampleData(), sampleMeta)
    await writeRaw({ meta: { schemaVersion: 1, settings: 'broken' } })

    const loaded = ready(await storage.load())

    expect(loaded.meta.settings).toEqual({ activeDeckId: null, language: 'auto' })
    expect(loaded.quarantined).toBe(1)
  })
})

describe('IndexedDB storage: versions', () => {
  it('migrates an older snapshot through the registered steps and rewrites it', async () => {
    // A fictional v0 where tasks had "name" instead of "title".
    const v0ToV1: Migration = (raw) => ({
      ...raw,
      tasks: raw.tasks.map((task) => {
        const { name, ...rest } = task as { name: string }
        return { ...rest, title: name }
      }),
    })
    const legacyTask: Record<string, unknown> = { ...makeTask({ id: 'old', deckId: 'home' }), name: 'Antiga' }
    delete legacyTask.title
    await createIndexedDbStorage(context())
    await writeRaw({ meta: { ...sampleMeta, schemaVersion: 0 }, decks: [{ id: 'home', name: 'Casa' }], tasks: [legacyTask] })

    const storage = await createIndexedDbStorage(context({ migrations: { 0: v0ToV1 } }))
    const loaded = ready(await storage.load())

    expect(loaded.data.tasks[0]).toMatchObject({ id: 'old', title: 'Antiga' })
    expect(loaded.quarantined).toBe(0)
    const raw = await readRaw()
    expect(raw.meta).toMatchObject({ schemaVersion: 1 })
    expect(raw.tasks[0]).toMatchObject({ title: 'Antiga' })
  })

  it('refuses data from a newer version, keeps it readable for export and never overwrites it', async () => {
    const storage = await createIndexedDbStorage(context())
    await storage.save(sampleData(), sampleMeta)
    await writeRaw({ meta: { ...sampleMeta, schemaVersion: 2, futureField: true } })
    const before = await readRaw()

    const newer = await createIndexedDbStorage(context())
    const result = await newer.load()

    expect(result).toMatchObject({ ok: false, error: 'newer-version', foundVersion: 2, supportedVersion: 1 })
    expect(result.ok ? null : result.raw.tasks).toHaveLength(2)
    await expect(newer.save(sampleData(), sampleMeta)).rejects.toBeInstanceOf(ReadOnlyStorageError)
    await expect(newer.clear()).rejects.toBeInstanceOf(ReadOnlyStorageError)
    expect(await readRaw()).toEqual(before)
  })

  it('reports a missing migration instead of guessing', async () => {
    await createIndexedDbStorage(context())
    await writeRaw({ meta: { ...sampleMeta, schemaVersion: 0 } })

    const result = await (await createIndexedDbStorage(context())).load()

    expect(result).toMatchObject({ ok: false, error: 'missing-migration', foundVersion: 0 })
  })
})

describe('IndexedDB storage: atomic saves', () => {
  it('keeps the previous snapshot when a write fails half way through', async () => {
    const storage = await createIndexedDbStorage(context())
    await storage.save(sampleData(), sampleMeta)
    // The first task is fine; the second cannot be stored (no key), so the
    // transaction fails after the clears and the first put were queued.
    const broken = {
      decks: [{ id: 'x', name: 'X' }],
      tasks: [makeTask({ id: 'fine', deckId: 'x' }), { title: 'no id' } as unknown as Task],
    }

    await expect(storage.save(broken, sampleMeta)).rejects.toThrow()

    expect(ready(await storage.load()).data).toEqual(sampleData())
  })

  it('keeps the previous snapshot when a value cannot be cloned', async () => {
    const storage = await createIndexedDbStorage(context())
    await storage.save(sampleData(), sampleMeta)
    const unclonable = { ...makeTask({ id: 'f', deckId: 'home' }), callback: () => undefined } as unknown as Task

    await expect(storage.save({ decks: sampleData().decks, tasks: [unclonable] }, sampleMeta)).rejects.toThrow()

    expect(ready(await storage.load()).data).toEqual(sampleData())
  })
})

describe('openStorage fallback', () => {
  it('uses IndexedDB when it opens', async () => {
    const opened = await openStorage(context())

    expect(opened).toMatchObject({ mode: 'indexeddb', fallbackReason: null })
  })

  it('falls back to memory when IndexedDB does not exist', async () => {
    vi.stubGlobal('indexedDB', undefined)

    const opened = await openStorage(context())

    expect(opened.mode).toBe('memory')
    expect(opened.storage.kind).toBe('memory')
    expect(opened.fallbackReason).toMatch(/not available/)
  })

  it('falls back to memory when opening throws (private mode, blocked, quota)', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new DOMException('The user denied permission', 'SecurityError')
      },
    })

    const opened = await openStorage(context())

    expect(opened.mode).toBe('memory')
    expect(opened.fallbackReason).toMatch(/denied/)
    // The fallback still works as a storage.
    await opened.storage.save(sampleData(), sampleMeta)
    expect(ready(await opened.storage.load()).data).toEqual(sampleData())
  })
})
