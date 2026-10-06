import { compareIds, compareNumbers } from './compare.ts'
import { dueToDate, isSameLocalDay, toDayKey } from './dates.ts'
import { isRecurring, type RecurringTask } from './recurrence.ts'
import type { Task } from './schemas.ts'

/**
 * THE visibility rule: whether a task is on the deck at `now`. Every caller
 * that shows, counts or announces cards goes through this function (a future
 * "postpone to tomorrow" belongs here too).
 * - Done tasks are never available.
 * - A recurring task is available from the local day of its due date on
 *   (overdue ones stay available); before that it is "dormant".
 * - A one-off task is always available, even with a future due date: only
 *   recurring tasks are hidden.
 */
export function isAvailable(task: Task, now: Date): boolean {
  if (task.status !== 'active') return false
  if (!isRecurring(task)) return true
  // "YYYY-MM-DD" strings compare in calendar order.
  return task.due.date <= toDayKey(now)
}

/** The tasks on the deck at `now`, in their original order. */
export function availableTasks(tasks: readonly Task[], now: Date): Task[] {
  return tasks.filter((task) => isAvailable(task, now))
}

/**
 * Active recurring tasks waiting for a future day, soonest first (by the
 * wall-clock instant of the due date, then id).
 */
export function dormantTasks(tasks: readonly Task[], now: Date): RecurringTask[] {
  return tasks
    .filter((task): task is RecurringTask => task.status === 'active' && isRecurring(task) && !isAvailable(task, now))
    .sort(
      (a, b) => compareNumbers(dueToDate(a.due).getTime(), dueToDate(b.due).getTime()) || compareIds(a.id, b.id),
    )
}

export interface DailyProgress {
  /** Tasks completed on the local day of `now` (one-off and recurring). */
  readonly done: number
  /** Tasks still on the deck (availableTasks). */
  readonly remaining: number
}

/** "done of done + remaining today". */
export function dailyProgress(tasks: readonly Task[], now: Date): DailyProgress {
  const done = tasks.filter((task) => task.completedAt !== null && isSameLocalDay(task.completedAt, now)).length
  return { done, remaining: availableTasks(tasks, now).length }
}
