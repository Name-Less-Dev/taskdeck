import { describe, expect, it } from 'vitest'
import { canRedo, canUndo, type AppData, type Deck, type Task } from '../../src/domain/index.ts'
import { createDeckState, DECK_HISTORY_LIMIT, deckReducer, type DeckAction, type DeckState } from '../../src/state/deckReducer.ts'
import { deepFreeze, localIso, makeTask, NOW } from '../domain/fixtures.ts'

const LATER = new Date(2026, 9, 5, 11, 0)
const home: Deck = { id: 'home', name: 'Casa' }
const work: Deck = { id: 'work', name: 'Trabalho' }

function initialData(): AppData {
  return deepFreeze({
    decks: [home, work],
    tasks: [
      makeTask({ id: 'one-off', deckId: 'home', title: 'Pay rent', due: { date: '2026-10-05' } }),
      makeTask({
        id: 'laundry',
        deckId: 'home',
        title: 'Laundry',
        due: { date: '2026-10-03' },
        recurrence: { unit: 'week', every: 1, anchor: 'due' },
        postponedDays: 2,
        skippedAt: localIso(2026, 9, 4, 18, 0),
      }),
      makeTask({ id: 'report', deckId: 'work', title: 'Report' }),
      makeTask({ id: 'done', deckId: 'work', status: 'done', completedAt: localIso(2026, 9, 1) }),
    ],
  })
}

function run(actions: readonly DeckAction[], from: DeckState = createDeckState(initialData())): DeckState {
  return actions.reduce(deckReducer, from)
}

function task(state: DeckState, id: string): Task | undefined {
  return state.present.tasks.find((candidate) => candidate.id === id)
}

function taskIds(state: DeckState): string[] {
  return state.present.tasks.map((candidate) => candidate.id)
}

describe('deckReducer: existing task actions', () => {
  it('starts with the given data, nothing to undo and a limit of 50', () => {
    const state = createDeckState(initialData())

    expect(state.present).toEqual(initialData())
    expect(state.limit).toBe(DECK_HISTORY_LIMIT)
    expect(DECK_HISTORY_LIMIT).toBe(50)
    expect(canUndo(state)).toBe(false)
  })

  it('adds a task to an existing deck', () => {
    const state = run([{ type: 'add', task: makeTask({ id: 'new', deckId: 'work' }), now: NOW }])

    expect(taskIds(state)).toEqual(['one-off', 'laundry', 'report', 'done', 'new'])
    expect(canUndo(state)).toBe(true)
  })

  it('completes a one-off task', () => {
    const state = run([{ type: 'complete', id: 'one-off', now: NOW }])

    expect(task(state, 'one-off')).toMatchObject({ status: 'done', completedAt: NOW.toISOString() })
  })

  it('completes a recurring task by moving its due date and resetting the counters', () => {
    const state = run([{ type: 'complete', id: 'laundry', now: NOW }])

    expect(task(state, 'laundry')).toMatchObject({ status: 'active', due: { date: '2026-10-10' }, postponedDays: 0 })
  })

  it('postpones a task using the action time', () => {
    const state = run([{ type: 'postpone', id: 'one-off', now: LATER }])

    expect(task(state, 'one-off')).toMatchObject({ skippedAt: LATER.toISOString(), postponedDays: 1 })
  })

  it('removes a task', () => {
    expect(taskIds(run([{ type: 'remove', id: 'one-off', now: NOW }]))).toEqual(['laundry', 'report', 'done'])
  })

  it('undo restores exactly the previous data, including postponedDays and recurrence', () => {
    const before = createDeckState(initialData())
    const state = run(
      [
        { type: 'postpone', id: 'laundry', now: NOW },
        { type: 'complete', id: 'laundry', now: LATER },
      ],
      before,
    )

    const undoneOnce = deckReducer(state, { type: 'undo', now: LATER })
    expect(task(undoneOnce, 'laundry')).toMatchObject({ postponedDays: 3, due: { date: '2026-10-03' } })

    const undoneTwice = deckReducer(undoneOnce, { type: 'undo', now: LATER })
    expect(undoneTwice.present).toBe(before.present)
  })

  it('redo re-applies an undone action and a new action discards the redo branch', () => {
    const completed = run([{ type: 'complete', id: 'one-off', now: NOW }])
    const undone = deckReducer(completed, { type: 'undo', now: NOW })
    expect(deckReducer(undone, { type: 'redo', now: NOW }).present).toBe(completed.present)

    const branched = deckReducer(undone, { type: 'remove', id: 'report', now: NOW })
    expect(canRedo(branched)).toBe(false)
  })
})

describe('deckReducer: decks', () => {
  it('adds a deck', () => {
    const state = run([{ type: 'addDeck', deck: { id: 'shop', name: ' Mercado ' }, now: NOW }])

    expect(state.present.decks).toEqual([home, work, { id: 'shop', name: 'Mercado' }])
  })

  it('renames a deck', () => {
    const state = run([{ type: 'renameDeck', id: 'work', name: 'Escritório', now: NOW }])

    expect(state.present.decks).toEqual([home, { id: 'work', name: 'Escritório' }])
  })

  it('removes a deck with its tasks, and undo brings both back', () => {
    const before = createDeckState(initialData())
    const removed = deckReducer(before, { type: 'removeDeck', id: 'work', now: NOW })
    expect(removed.present.decks).toEqual([home])
    expect(taskIds(removed)).toEqual(['one-off', 'laundry'])

    const undone = deckReducer(removed, { type: 'undo', now: NOW })
    expect(undone.present).toBe(before.present)

    const redone = deckReducer(undone, { type: 'redo', now: NOW })
    expect(redone.present).toBe(removed.present)
  })
})

describe('deckReducer: editing', () => {
  it('updates a task and keeps its recurrence', () => {
    const state = run([{ type: 'updateTask', id: 'laundry', patch: { title: 'Lavar', tags: ['Casa'] }, now: NOW }])

    expect(task(state, 'laundry')).toMatchObject({
      title: 'Lavar',
      tags: ['casa'],
      recurrence: { unit: 'week', every: 1, anchor: 'due' },
      postponedDays: 2,
    })
  })

  it('moves a task to another deck', () => {
    const state = run([{ type: 'updateTask', id: 'one-off', patch: { deckId: 'work' }, now: NOW }])

    expect(task(state, 'one-off')?.deckId).toBe('work')
  })
})

describe('deckReducer: replaceAll', () => {
  const imported: AppData = deepFreeze({
    decks: [{ id: 'x', name: 'Importado' }],
    tasks: [makeTask({ id: 'i1', deckId: 'x' })],
  })

  it('replaces everything, and undo restores the previous data', () => {
    const before = createDeckState(initialData())

    const replaced = deckReducer(before, { type: 'replaceAll', data: imported, now: NOW })
    expect(replaced.present).toBe(imported)

    expect(deckReducer(replaced, { type: 'undo', now: NOW }).present).toBe(before.present)
  })
})

describe('deckReducer: no-ops never push history', () => {
  it.each<[string, DeckAction]>([
    ['complete an unknown task', { type: 'complete', id: 'missing', now: NOW }],
    ['complete a done task', { type: 'complete', id: 'done', now: NOW }],
    ['postpone an unknown task', { type: 'postpone', id: 'missing', now: NOW }],
    ['postpone a done task', { type: 'postpone', id: 'done', now: NOW }],
    ['remove an unknown task', { type: 'remove', id: 'missing', now: NOW }],
    ['add a task to an unknown deck', { type: 'add', task: makeTask({ id: 'n', deckId: 'nope' }), now: NOW }],
    ['add a task with a taken id', { type: 'add', task: makeTask({ id: 'report', deckId: 'work' }), now: NOW }],
    ['update an unknown task', { type: 'updateTask', id: 'missing', patch: { title: 'x' }, now: NOW }],
    ['update with an invalid patch', { type: 'updateTask', id: 'one-off', patch: { title: '' }, now: NOW }],
    ['remove the due date of a recurring task', { type: 'updateTask', id: 'laundry', patch: { due: null }, now: NOW }],
    ['update without any change', { type: 'updateTask', id: 'one-off', patch: { title: 'Pay rent' }, now: NOW }],
    ['move a task to an unknown deck', { type: 'updateTask', id: 'one-off', patch: { deckId: 'nope' }, now: NOW }],
    ['add a deck with a duplicate name', { type: 'addDeck', deck: { id: 'n', name: 'casa' }, now: NOW }],
    ['add a deck with a taken id', { type: 'addDeck', deck: { id: 'home', name: 'Outro' }, now: NOW }],
    ['add a deck with an empty name', { type: 'addDeck', deck: { id: 'n', name: ' ' }, now: NOW }],
    ['rename an unknown deck', { type: 'renameDeck', id: 'missing', name: 'X', now: NOW }],
    ['rename to the same name', { type: 'renameDeck', id: 'home', name: 'Casa', now: NOW }],
    ['rename to a duplicate name', { type: 'renameDeck', id: 'home', name: 'TRABALHO', now: NOW }],
    ['remove an unknown deck', { type: 'removeDeck', id: 'missing', now: NOW }],
    ['replace with data that has no deck', { type: 'replaceAll', data: { decks: [], tasks: [] }, now: NOW }],
    [
      'replace with orphan tasks',
      { type: 'replaceAll', data: { decks: [home], tasks: [makeTask({ deckId: 'gone' })] }, now: NOW },
    ],
    ['undo with no history', { type: 'undo', now: NOW }],
    ['redo with nothing undone', { type: 'redo', now: NOW }],
  ])('%s', (_label, action) => {
    const state = createDeckState(initialData())

    const next = deckReducer(state, action)

    expect(next).toBe(state)
    expect(canUndo(next)).toBe(false)
  })

  it('refuses to remove the last deck', () => {
    const single = createDeckState({ decks: [home], tasks: [] })

    expect(deckReducer(single, { type: 'removeDeck', id: 'home', now: NOW })).toBe(single)
  })

  it('never mutates the previous state', () => {
    const state = deepFreeze(createDeckState(initialData()))

    expect(() =>
      run(
        [
          { type: 'removeDeck', id: 'work', now: NOW },
          { type: 'addDeck', deck: { id: 'z', name: 'Z' }, now: NOW },
          { type: 'updateTask', id: 'one-off', patch: { title: 'Mudou' }, now: NOW },
        ],
        state,
      ),
    ).not.toThrow()
    expect(state.present.decks).toHaveLength(2)
  })
})

describe('deckReducer: snooze and unsnooze', () => {
  it('snoozes until tomorrow with an undo entry, and redo applies it again', () => {
    const snoozed = run([{ type: 'snooze', id: 'report', now: NOW }])

    expect(task(snoozed, 'report')).toMatchObject({ snoozedUntil: '2026-10-06', postponedDays: 1 })
    expect(canUndo(snoozed)).toBe(true)
    const undone = deckReducer(snoozed, { type: 'undo', now: LATER })
    expect(task(undone, 'report')?.snoozedUntil).toBeNull()
    expect(task(deckReducer(undone, { type: 'redo', now: LATER }), 'report')?.snoozedUntil).toBe('2026-10-06')
  })

  it('unsnooze brings it back, with its own undo entry', () => {
    const snoozed = run([{ type: 'snooze', id: 'report', now: NOW }])
    const back = deckReducer(snoozed, { type: 'unsnooze', id: 'report', now: LATER })

    expect(task(back, 'report')?.snoozedUntil).toBeNull()
    expect(task(deckReducer(back, { type: 'undo', now: LATER }), 'report')?.snoozedUntil).toBe('2026-10-06')
  })

  it.each<[string, DeckAction]>([
    ['snoozing an already snoozed task', { type: 'snooze', id: 'report', now: LATER }],
    ['snoozing a done task', { type: 'snooze', id: 'done', now: LATER }],
    ['snoozing an unknown task', { type: 'snooze', id: 'nope', now: LATER }],
    ['unsnoozing a task that is not snoozed', { type: 'unsnooze', id: 'one-off', now: LATER }],
  ])('is a no-op without a history entry: %s', (_name, action) => {
    const before = run([{ type: 'snooze', id: 'report', now: NOW }])

    expect(deckReducer(before, action)).toBe(before)
  })
})
