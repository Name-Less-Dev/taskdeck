import { describe, expect, it } from 'vitest'
import {
  canRedo,
  canUndo,
  createHistory,
  DEFAULT_HISTORY_LIMIT,
  pushHistory,
  redo,
  undo,
  type History,
} from '../../src/domain/index.ts'
import { deepFreeze } from './fixtures.ts'

function pushAll<T>(history: History<T>, values: readonly T[]): History<T> {
  return values.reduce(pushHistory, history)
}

describe('history', () => {
  it('starts with only the present and a default limit of 50', () => {
    const history = createHistory('a')

    expect(history).toEqual({ past: [], present: 'a', future: [], limit: DEFAULT_HISTORY_LIMIT })
    expect(DEFAULT_HISTORY_LIMIT).toBe(50)
    expect(canUndo(history)).toBe(false)
    expect(canRedo(history)).toBe(false)
  })

  it('pushes, undoes and redoes', () => {
    const pushed = pushAll(createHistory('a'), ['b', 'c'])
    expect(pushed.present).toBe('c')

    const undone = undo(undo(pushed))
    expect(undone.present).toBe('a')
    expect(canUndo(undone)).toBe(false)
    expect(canRedo(undone)).toBe(true)

    const redone = redo(undone)
    expect(redone.present).toBe('b')
    expect(redo(redone).present).toBe('c')
  })

  it('returns the same history when undoing at the start or redoing at the end', () => {
    const start = createHistory('a')
    const end = pushHistory(start, 'b')

    expect(undo(start)).toBe(start)
    expect(redo(end)).toBe(end)
  })

  it('discards the redo stack when pushing after an undo', () => {
    const branched = pushHistory(undo(pushAll(createHistory('a'), ['b', 'c'])), 'x')

    expect(branched.present).toBe('x')
    expect(canRedo(branched)).toBe(false)
    expect(undo(branched).present).toBe('b')
  })

  it('drops the oldest entries beyond the limit', () => {
    const history = pushAll(createHistory(0, 3), [1, 2, 3, 4, 5])

    expect(history.past).toEqual([2, 3, 4])
    expect(undo(undo(undo(undo(history)))).present).toBe(2)
  })

  it('works with values that are undefined', () => {
    const history = pushHistory(createHistory<string | undefined>(undefined), 'a')

    expect(undo(history).present).toBeUndefined()
    expect(redo(undo(history)).present).toBe('a')
  })

  it('never mutates a previous history', () => {
    const base = deepFreeze(pushAll(createHistory('a'), ['b', 'c']))

    const results = [pushHistory(base, 'd'), undo(base), redo(undo(base))]

    expect(base).toEqual({ past: ['a', 'b'], present: 'c', future: [], limit: 50 })
    expect(results.map((h) => h.present)).toEqual(['d', 'b', 'c'])
  })

  it.each([0, -1, 1.5])('rejects a limit of %s', (limit) => {
    expect(() => createHistory('a', limit)).toThrow(RangeError)
  })
})
