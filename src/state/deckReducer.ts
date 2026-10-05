import {
  canRedo,
  canUndo,
  completeTask,
  createHistory,
  postponeTask,
  pushHistory,
  redo,
  removeTask,
  undo,
  upsertTask,
  type History,
  type Task,
} from '../domain/index.ts'

/** Maximum number of undo steps kept for the deck. */
export const DECK_HISTORY_LIMIT = 50

/** The whole deck state is the undo history of the task list. */
export type DeckState = History<readonly Task[]>

/**
 * Every action carries the instant it happened. The reducer never reads the
 * clock; undo/redo ignore `now` but keep the same shape for logging and replay.
 */
export type DeckAction =
  | { readonly type: 'add'; readonly task: Task; readonly now: Date }
  | { readonly type: 'complete'; readonly id: string; readonly now: Date }
  | { readonly type: 'postpone'; readonly id: string; readonly now: Date }
  | { readonly type: 'remove'; readonly id: string; readonly now: Date }
  | { readonly type: 'undo'; readonly now: Date }
  | { readonly type: 'redo'; readonly now: Date }

export function createDeckState(tasks: readonly Task[]): DeckState {
  return createHistory(tasks, DECK_HISTORY_LIMIT)
}

function findActive(tasks: readonly Task[], id: string): Task | null {
  const task = tasks.find((candidate) => candidate.id === id)
  return task !== undefined && task.status === 'active' ? task : null
}

/**
 * Pure reducer over the domain functions. Actions that change nothing
 * (unknown id, task already done) return the same state object, so no
 * history entry is pushed and React skips the re-render.
 */
export function deckReducer(state: DeckState, action: DeckAction): DeckState {
  const tasks = state.present

  switch (action.type) {
    case 'add':
      return pushHistory(state, upsertTask(tasks, action.task))

    case 'complete': {
      const task = findActive(tasks, action.id)
      return task === null ? state : pushHistory(state, upsertTask(tasks, completeTask(task, action.now)))
    }

    case 'postpone': {
      const task = findActive(tasks, action.id)
      return task === null ? state : pushHistory(state, upsertTask(tasks, postponeTask(task, action.now)))
    }

    case 'remove':
      return tasks.some((task) => task.id === action.id)
        ? pushHistory(state, removeTask(tasks, action.id))
        : state

    case 'undo':
      return canUndo(state) ? undo(state) : state

    case 'redo':
      return canRedo(state) ? redo(state) : state
  }
}
