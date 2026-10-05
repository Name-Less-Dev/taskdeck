/** Immutable undo/redo stack. `past` is oldest first; `future` is next-to-redo first. */
export interface History<T> {
  readonly past: readonly T[]
  readonly present: T
  readonly future: readonly T[]
  /** Maximum number of undo steps kept in `past`. */
  readonly limit: number
}

export const DEFAULT_HISTORY_LIMIT = 50

export function createHistory<T>(initial: T, limit: number = DEFAULT_HISTORY_LIMIT): History<T> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`History limit must be a positive integer, got ${limit}`)
  }
  return { past: [], present: initial, future: [], limit }
}

/** Records a new present. Clears the redo stack and drops the oldest entry beyond the limit. */
export function pushHistory<T>(history: History<T>, value: T): History<T> {
  const past = [...history.past, history.present]
  return {
    past: past.length > history.limit ? past.slice(past.length - history.limit) : past,
    present: value,
    future: [],
    limit: history.limit,
  }
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0
}

/** Steps back one entry; returns the same history when there is nothing to undo. */
export function undo<T>(history: History<T>): History<T> {
  if (!canUndo(history)) return history
  // Length checked above; the assertion only drops the "| undefined" added by
  // noUncheckedIndexedAccess (T itself may legitimately include undefined).
  const previous = history.past[history.past.length - 1] as T
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    limit: history.limit,
  }
}

/** Steps forward one entry; returns the same history when there is nothing to redo. */
export function redo<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history
  // Length checked above; see undo().
  const next = history.future[0] as T
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
    limit: history.limit,
  }
}
