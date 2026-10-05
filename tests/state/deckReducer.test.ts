import { describe, expect, it } from 'vitest'
import { canRedo, canUndo, type Task } from '../../src/domain/index.ts'
import { createDeckState, DECK_HISTORY_LIMIT, deckReducer, type DeckAction } from '../../src/state/deckReducer.ts'
import { deepFreeze, localIso, makeTask, NOW } from '../domain/fixtures.ts'

const LATER = new Date(2026, 9, 5, 11, 0)

function initialTasks(): readonly Task[] {
  return deepFreeze([
    makeTask({ id: 'one-off', title: 'Pay rent', due: { date: '2026-10-05' } }),
    makeTask({
      id: 'laundry',
      title: 'Laundry',
      due: { date: '2026-10-03' },
      recurrence: { unit: 'week', every: 1, anchor: 'due' },
      postponedDays: 2,
      skippedAt: localIso(2026, 9, 4, 18, 0),
    }),
    makeTask({ id: 'done', status: 'done', completedAt: localIso(2026, 9, 1) }),
  ])
}

function run(actions: readonly DeckAction[]) {
  return actions.reduce(deckReducer, createDeckState(initialTasks()))
}

function byId(tasks: readonly Task[], id: string): Task | undefined {
  return tasks.find((task) => task.id === id)
}

describe('deckReducer', () => {
  it('starts with the given tasks, nothing to undo and a limit of 50', () => {
    const state = createDeckState(initialTasks())

    expect(state.present).toEqual(initialTasks())
    expect(state.limit).toBe(DECK_HISTORY_LIMIT)
    expect(DECK_HISTORY_LIMIT).toBe(50)
    expect(canUndo(state)).toBe(false)
  })

  it('adds a task and records it in the history', () => {
    const added = makeTask({ id: 'new', title: 'New' })

    const state = run([{ type: 'add', task: added, now: NOW }])

    expect(state.present.map((task) => task.id)).toEqual(['one-off', 'laundry', 'done', 'new'])
    expect(canUndo(state)).toBe(true)
  })

  it('completes a one-off task', () => {
    const state = run([{ type: 'complete', id: 'one-off', now: NOW }])

    expect(byId(state.present, 'one-off')).toMatchObject({ status: 'done', completedAt: NOW.toISOString() })
  })

  it('completes a recurring task by moving its due date and resetting the counters', () => {
    const state = run([{ type: 'complete', id: 'laundry', now: NOW }])

    expect(byId(state.present, 'laundry')).toMatchObject({
      status: 'active',
      due: { date: '2026-10-10' },
      postponedDays: 0,
      skippedAt: null,
    })
  })

  it('postpones a task using the action time', () => {
    const state = run([{ type: 'postpone', id: 'one-off', now: LATER }])

    expect(byId(state.present, 'one-off')).toMatchObject({ skippedAt: LATER.toISOString(), postponedDays: 1 })
  })

  it('removes a task', () => {
    const state = run([{ type: 'remove', id: 'one-off', now: NOW }])

    expect(state.present.map((task) => task.id)).toEqual(['laundry', 'done'])
  })

  it.each<DeckAction>([
    { type: 'complete', id: 'missing', now: NOW },
    { type: 'complete', id: 'done', now: NOW },
    { type: 'postpone', id: 'missing', now: NOW },
    { type: 'postpone', id: 'done', now: NOW },
    { type: 'remove', id: 'missing', now: NOW },
    { type: 'undo', now: NOW },
    { type: 'redo', now: NOW },
  ])('returns the same state without a history entry for a no-op: %o', (action) => {
    const state = createDeckState(initialTasks())

    const next = deckReducer(state, action)

    expect(next).toBe(state)
    expect(canUndo(next)).toBe(false)
  })

  it('undo restores exactly the previous task list, including postponedDays and recurrence', () => {
    const before = createDeckState(initialTasks())

    const after = [
      { type: 'postpone', id: 'laundry', now: NOW },
      { type: 'complete', id: 'laundry', now: LATER },
    ] satisfies DeckAction[]
    const state = after.reduce(deckReducer, before)
    expect(byId(state.present, 'laundry')).toMatchObject({ postponedDays: 0, due: { date: '2026-10-10' } })

    const undoneOnce = deckReducer(state, { type: 'undo', now: LATER })
    expect(byId(undoneOnce.present, 'laundry')).toMatchObject({ postponedDays: 3, due: { date: '2026-10-03' } })

    const undoneTwice = deckReducer(undoneOnce, { type: 'undo', now: LATER })
    expect(undoneTwice.present).toBe(before.present)
    expect(byId(undoneTwice.present, 'laundry')).toEqual(byId(initialTasks(), 'laundry'))
  })

  it('redo re-applies an undone action', () => {
    const completed = run([{ type: 'complete', id: 'one-off', now: NOW }])
    const undone = deckReducer(completed, { type: 'undo', now: NOW })

    const redone = deckReducer(undone, { type: 'redo', now: NOW })

    expect(redone.present).toBe(completed.present)
    expect(canRedo(redone)).toBe(false)
  })

  it('a new action after undo discards the redo branch', () => {
    const state = run([
      { type: 'complete', id: 'one-off', now: NOW },
      { type: 'undo', now: NOW },
      { type: 'remove', id: 'laundry', now: NOW },
    ])

    expect(canRedo(state)).toBe(false)
    expect(state.present.map((task) => task.id)).toEqual(['one-off', 'done'])
  })

  it('never mutates the previous state', () => {
    const state = deepFreeze(createDeckState(initialTasks()))

    expect(() => run([{ type: 'complete', id: 'one-off', now: NOW }])).not.toThrow()
    expect(() => deckReducer(state, { type: 'remove', id: 'laundry', now: NOW })).not.toThrow()
    expect(state.present).toHaveLength(3)
  })
})
