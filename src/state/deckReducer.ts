import { ZodError } from 'zod'
import {
  canRedo,
  canUndo,
  checkIntegrity,
  completeTask,
  createHistory,
  postponeTask,
  pushHistory,
  redo,
  removeDeck,
  removeTask,
  renameDeck,
  createDeck,
  snoozeTask,
  unsnoozeTask,
  undo,
  updateTask,
  upsertTask,
  type AppData,
  type Deck,
  type History,
  type Task,
  type TaskPatch,
} from '../domain/index.ts'

/** Maximum number of undo steps kept. */
export const DECK_HISTORY_LIMIT = 50

/** The undoable state is the history of all decks and tasks. */
export type DeckState = History<AppData>

/**
 * Every action carries the instant it happened and any ids it needs. The
 * reducer never reads the clock or generates ids.
 */
export type DeckAction =
  | { readonly type: 'add'; readonly task: Task; readonly now: Date }
  | { readonly type: 'complete'; readonly id: string; readonly now: Date }
  | { readonly type: 'postpone'; readonly id: string; readonly now: Date }
  | { readonly type: 'remove'; readonly id: string; readonly now: Date }
  | { readonly type: 'snooze'; readonly id: string; readonly now: Date }
  | { readonly type: 'unsnooze'; readonly id: string; readonly now: Date }
  | { readonly type: 'updateTask'; readonly id: string; readonly patch: TaskPatch; readonly now: Date }
  | { readonly type: 'addDeck'; readonly deck: Deck; readonly now: Date }
  | { readonly type: 'renameDeck'; readonly id: string; readonly name: string; readonly now: Date }
  | { readonly type: 'removeDeck'; readonly id: string; readonly now: Date }
  | { readonly type: 'replaceAll'; readonly data: AppData; readonly now: Date }
  | { readonly type: 'undo'; readonly now: Date }
  | { readonly type: 'redo'; readonly now: Date }

export function createDeckState(data: AppData): DeckState {
  return createHistory(data, DECK_HISTORY_LIMIT)
}

function findActive(tasks: readonly Task[], id: string): Task | null {
  const task = tasks.find((candidate) => candidate.id === id)
  return task !== undefined && task.status === 'active' ? task : null
}

/** Runs a validating domain call; an invalid result means "no change". */
function attempt<T>(run: () => T): T | null {
  try {
    return run()
  } catch (error) {
    if (error instanceof ZodError) return null
    throw error
  }
}

/** Tasks are frozen plain data, so JSON equality is exact here. */
function sameTask(a: Task, b: Task): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Computes the next AppData, or null when the action is invalid or changes nothing. */
function apply(data: AppData, action: Exclude<DeckAction, { type: 'undo' | 'redo' }>): AppData | null {
  const { decks, tasks } = data
  const withTasks = (next: readonly Task[]): AppData => ({ decks, tasks: next })

  switch (action.type) {
    case 'add': {
      const deckExists = decks.some((deck) => deck.id === action.task.deckId)
      const idTaken = tasks.some((task) => task.id === action.task.id)
      return deckExists && !idTaken ? withTasks([...tasks, action.task]) : null
    }

    case 'complete': {
      const task = findActive(tasks, action.id)
      return task === null ? null : withTasks(upsertTask(tasks, completeTask(task, action.now)))
    }

    case 'postpone': {
      const task = findActive(tasks, action.id)
      return task === null ? null : withTasks(upsertTask(tasks, postponeTask(task, action.now)))
    }

    case 'snooze':
    case 'unsnooze': {
      const task = findActive(tasks, action.id)
      if (task === null) return null
      const next = action.type === 'snooze' ? snoozeTask(task, action.now) : unsnoozeTask(task)
      // Not snoozable / nothing to clear: no change, no history entry.
      return next === task ? null : withTasks(upsertTask(tasks, next))
    }

    case 'remove':
      return tasks.some((task) => task.id === action.id) ? withTasks(removeTask(tasks, action.id)) : null

    case 'updateTask': {
      const task = tasks.find((candidate) => candidate.id === action.id)
      if (task === undefined) return null
      const updated = attempt(() => updateTask(task, action.patch))
      if (updated === null || sameTask(updated, task)) return null
      if (!decks.some((deck) => deck.id === updated.deckId)) return null
      return withTasks(upsertTask(tasks, updated))
    }

    case 'addDeck': {
      const deck = attempt(() => createDeck({ name: action.deck.name }, { id: action.deck.id, existing: decks }))
      return deck === null ? null : { decks: [...decks, deck], tasks }
    }

    case 'renameDeck': {
      const deck = decks.find((candidate) => candidate.id === action.id)
      if (deck === undefined) return null
      const renamed = attempt(() => renameDeck(deck, action.name, decks))
      if (renamed === null || renamed.name === deck.name) return null
      return { decks: decks.map((candidate) => (candidate.id === deck.id ? renamed : candidate)), tasks }
    }

    case 'removeDeck': {
      const next = removeDeck(data, action.id)
      return next === data ? null : next
    }

    case 'replaceAll':
      return checkIntegrity(action.data).length === 0 ? action.data : null
  }
}

/**
 * Pure reducer over the domain functions. Actions that are invalid or change
 * nothing return the same state object, so no history entry is pushed and
 * React skips the re-render.
 */
export function deckReducer(state: DeckState, action: DeckAction): DeckState {
  switch (action.type) {
    case 'undo':
      return canUndo(state) ? undo(state) : state
    case 'redo':
      return canRedo(state) ? redo(state) : state
    default: {
      const next = apply(state.present, action)
      return next === null ? state : pushHistory(state, next)
    }
  }
}
