import { isAvailable, toDayKey, type DayKey, type Task } from '../domain/index.ts'

/** What was hidden (dormant or snoozed) on the last day the app saw. */
export interface RolloverState {
  readonly day: DayKey
  readonly waitingIds: ReadonlySet<string>
}

/**
 * Detects cards that became available because the local day changed (the
 * app stayed open past midnight, or the tab came back on a later day):
 * recurring cards reaching their day and snoozed cards coming back.
 * The first call (state null, i.e. the initial load) and calls on the same
 * day only record the snapshot: completing, editing or undoing during the
 * day never counts as "new cards for today".
 */
export function rolloverStep(
  state: RolloverState | null,
  tasks: readonly Task[],
  now: Date,
): { state: RolloverState; appeared: number } {
  const day = toDayKey(now)
  const waiting = tasks.filter((task) => task.status === 'active' && !isAvailable(task, now))
  const next = { day, waitingIds: new Set(waiting.map((task) => task.id)) }
  if (state === null || state.day === day) return { state: next, appeared: 0 }
  const appeared = tasks.filter((task) => state.waitingIds.has(task.id) && isAvailable(task, now)).length
  return { state: next, appeared }
}
