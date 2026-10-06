import { dormantTasks, isAvailable, toDayKey, type DayKey, type Task } from '../domain/index.ts'

/** What was dormant on the last day the app saw. */
export interface RolloverState {
  readonly day: DayKey
  readonly dormantIds: ReadonlySet<string>
}

/**
 * Detects cards that became available because the local day changed (the
 * app stayed open past midnight, or the tab came back on a later day).
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
  const next = { day, dormantIds: new Set(dormantTasks(tasks, now).map((task) => task.id)) }
  if (state === null || state.day === day) return { state: next, appeared: 0 }
  const appeared = tasks.filter((task) => state.dormantIds.has(task.id) && isAvailable(task, now)).length
  return { state: next, appeared }
}
