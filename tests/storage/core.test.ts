import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAutosaver,
  createMemoryStorage,
  getPersistence,
  migrate,
  ReadOnlyStorageError,
  requestPersistence,
  type Meta,
  type RawSnapshot,
} from '../../src/storage/index.ts'
import { makeTask } from '../domain/fixtures.ts'
import { context, sampleData, sampleMeta } from './helpers.ts'

describe('migrate', () => {
  const v0: RawSnapshot = { schemaVersion: 0, meta: {}, decks: [], tasks: [{ name: 'a' }] }

  it('returns current snapshots unchanged', () => {
    const current: RawSnapshot = { ...v0, schemaVersion: 1 }

    expect(migrate(current, {})).toEqual({ ok: true, snapshot: current, migratedFrom: null })
  })

  it('treats a snapshot without a version as current', () => {
    expect(migrate({ ...v0, schemaVersion: null }, {})).toMatchObject({ ok: true, migratedFrom: null })
  })

  it('applies every step in order up to the target version', () => {
    const calls: number[] = []
    const registry = {
      0: (raw: RawSnapshot) => (calls.push(0), { ...raw, tasks: [{ title: 'from v0' }] }),
      1: (raw: RawSnapshot) => (calls.push(1), { ...raw, decks: [{ id: 'added in v2' }] }),
    }

    const result = migrate(v0, registry, 2)

    expect(calls).toEqual([0, 1])
    expect(result).toEqual({
      ok: true,
      migratedFrom: 0,
      snapshot: { schemaVersion: 2, meta: {}, decks: [{ id: 'added in v2' }], tasks: [{ title: 'from v0' }] },
    })
  })

  it('refuses a newer version', () => {
    expect(migrate({ ...v0, schemaVersion: 3 }, {}, 1)).toEqual({ ok: false, error: 'newer-version', foundVersion: 3 })
  })

  it('reports a missing step', () => {
    expect(migrate(v0, {}, 1)).toEqual({ ok: false, error: 'missing-migration', foundVersion: 0 })
  })

  it('ships no migrations yet: v1 is the first format', async () => {
    const { MIGRATIONS, SCHEMA_VERSION } = await import('../../src/storage/index.ts')

    expect(SCHEMA_VERSION).toBe(1)
    expect(MIGRATIONS).toEqual({})
  })
})

describe('memory storage', () => {
  it('follows the same load rules as IndexedDB', async () => {
    const storage = createMemoryStorage(context(), {
      meta: sampleMeta,
      decks: [{ id: 'home', name: 'Casa' }],
      tasks: [makeTask({ id: 'ok', deckId: 'home' }), { id: 'bad' }, makeTask({ id: 'orphan', deckId: 'gone' })],
    })

    const loaded = await storage.load()

    expect(loaded).toMatchObject({ ok: true, quarantined: 1, recovered: 1 })
    expect(storage.snapshot().quarantine).toHaveLength(1)
  })

  it('round-trips a snapshot and copies values in and out', async () => {
    const storage = createMemoryStorage(context())
    const data = sampleData()
    await storage.save(data, sampleMeta)

    const loaded = await storage.load()

    expect(loaded).toMatchObject({ ok: true, data, meta: sampleMeta })
    expect(loaded.ok && loaded.data).not.toBe(data)
  })

  it('rejects an unclonable snapshot without changing what it holds', async () => {
    const storage = createMemoryStorage(context())
    await storage.save(sampleData(), sampleMeta)
    const bad = { decks: [], tasks: [{ fn: () => undefined }] } as unknown as Parameters<typeof storage.save>[0]

    await expect(storage.save(bad, sampleMeta)).rejects.toThrow()
    expect(storage.snapshot().tasks).toHaveLength(2)
  })

  it('becomes read-only after finding a newer version', async () => {
    const storage = createMemoryStorage(context(), { meta: { ...sampleMeta, schemaVersion: 9 } })

    expect(await storage.load()).toMatchObject({ ok: false, error: 'newer-version' })
    await expect(storage.save(sampleData(), sampleMeta)).rejects.toBeInstanceOf(ReadOnlyStorageError)
    await expect(storage.clear()).rejects.toBeInstanceOf(ReadOnlyStorageError)
  })

  it('clears everything', async () => {
    const storage = createMemoryStorage(context())
    await storage.save(sampleData(), sampleMeta)

    await storage.clear()

    expect(await storage.load()).toMatchObject({ ok: true, firstRun: true })
  })
})

describe('autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const meta: Meta = sampleMeta

  function setup(save = vi.fn((): Promise<void> => Promise.resolve())) {
    const onError = vi.fn()
    const onSaved = vi.fn()
    return { save, onError, onSaved, saver: createAutosaver({ save, onError, onSaved }) }
  }

  it('waits 300 ms of quiet and saves only the latest snapshot', async () => {
    const { save, saver } = setup()
    const first = sampleData()
    const second = { ...sampleData(), decks: [] }

    saver.schedule(first, meta)
    await vi.advanceTimersByTimeAsync(200)
    saver.schedule(second, meta)
    await vi.advanceTimersByTimeAsync(299)
    expect(save).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(second, meta)
  })

  it('flushes immediately (page hidden / pagehide) and cancels the timer', async () => {
    const { save, saver } = setup()
    saver.schedule(sampleData(), meta)

    await saver.flush()
    expect(save).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('does nothing on flush when nothing is pending', async () => {
    const { save, saver } = setup()

    await saver.flush()

    expect(save).not.toHaveBeenCalled()
    expect(saver.hasPending()).toBe(false)
  })

  it('reports errors without throwing and retries the failed snapshot', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('QuotaExceededError')).mockResolvedValue(undefined)
    const { saver, onError, onSaved } = setup(save)
    const data = sampleData()

    saver.schedule(data, meta)
    await expect(saver.flush()).resolves.toBeUndefined()
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'QuotaExceededError' }))
    expect(saver.hasPending()).toBe(true)

    await saver.retry()
    expect(save).toHaveBeenLastCalledWith(data, meta)
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(saver.hasPending()).toBe(false)
  })

  it('never runs two saves at the same time', async () => {
    let active = 0
    let maxActive = 0
    const save = vi.fn(async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 50))
      active -= 1
    })
    const { saver } = setup(save)

    saver.schedule(sampleData(), meta)
    const firstFlush = saver.flush()
    // Let the first save start, then queue a newer snapshot while it runs.
    await vi.advanceTimersByTimeAsync(0)
    expect(active).toBe(1)
    saver.schedule({ ...sampleData(), tasks: [] }, meta)
    const secondFlush = saver.flush()
    await vi.advanceTimersByTimeAsync(200)
    await Promise.all([firstFlush, secondFlush])

    expect(save).toHaveBeenCalledTimes(2)
    expect(maxActive).toBe(1)
  })

  it('stops its timer on dispose', async () => {
    const { save, saver } = setup()
    saver.schedule(sampleData(), meta)

    saver.dispose()
    await vi.advanceTimersByTimeAsync(1000)

    expect(save).not.toHaveBeenCalled()
  })
})

describe('persistent storage', () => {
  it('is unavailable when navigator.storage is missing (insecure context)', async () => {
    expect(await requestPersistence({})).toEqual({ supported: false, persisted: false })
    expect(await getPersistence({})).toEqual({ supported: false, persisted: false })
  })

  it('reports a denied request', async () => {
    const storage = { persist: vi.fn(() => Promise.resolve(false)) }

    expect(await requestPersistence({ storage })).toEqual({ supported: true, persisted: false })
    expect(storage.persist).toHaveBeenCalledTimes(1)
  })

  it('reports a granted request', async () => {
    expect(await requestPersistence({ storage: { persist: () => Promise.resolve(true) } })).toEqual({
      supported: true,
      persisted: true,
    })
  })

  it('reads the current state without requesting', async () => {
    const storage = { persist: vi.fn(), persisted: () => Promise.resolve(true) }

    expect(await getPersistence({ storage })).toEqual({ supported: true, persisted: true })
    expect(storage.persist).not.toHaveBeenCalled()
  })

  it('treats a throwing API as not persisted', async () => {
    const storage = { persist: () => Promise.reject(new Error('nope')), persisted: () => Promise.reject(new Error('nope')) }

    expect(await requestPersistence({ storage })).toEqual({ supported: true, persisted: false })
    expect(await getPersistence({ storage })).toEqual({ supported: true, persisted: false })
  })
})
