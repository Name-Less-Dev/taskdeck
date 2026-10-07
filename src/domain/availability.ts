import { compareIds, compareNumbers } from './compare.ts'
import { dueToDate, isSameLocalDay, toDayKey } from './dates.ts'
import { isRecurring, type RecurringTask } from './recurrence.ts'
import type { Task } from './schemas.ts'

/**
 * Snoozed ("Tomorrow"): snoozedUntil is a local day after today. A value of
 * today or earlier is harmless and means "not snoozed".
 */
export function isSnoozed(task: Task, now: Date): boolean {
  return task.snoozedUntil !== null && task.snoozedUntil > toDayKey(now)
}

/**
 * THE visibility rule: whether a task is on the deck at `now`. Every caller
 * that shows, counts, reminds or announces cards goes through this function.
 * - Done tasks are never available.
 * - Snoozed tasks are hidden until their day (the due date is untouched).
 * - A recurring task is available from the local day of its due date on
 *   (overdue ones stay available); before that it is "dormant".
 * - A one-off task is otherwise always available, even with a future due
 *   date: only recurring tasks wait for their day.
 */
export function isAvailable(task: Task, now: Date): boolean {
  if (task.status !== 'active') return false
  if (isSnoozed(task, now)) return false
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
 * wall-clock instant of the due date, then id). Snoozed tasks are never
 * here: they are in snoozedTasks (the two groups never overlap).
 */
export function dormantTasks(tasks: readonly Task[], now: Date): RecurringTask[] {
  return tasks
    .filter(
      (task): task is RecurringTask =>
        task.status === 'active' && isRecurring(task) && !isSnoozed(task, now) && !isAvailable(task, now),
    )
    .sort(
      (a, b) => compareNumbers(dueToDate(a.due).getTime(), dueToDate(b.due).getTime()) || compareIds(a.id, b.id),
    )
}

/** Active tasks snoozed until a later day, by title (code units) then id. */
export function snoozedTasks(tasks: readonly Task[], now: Date): Task[] {
  return tasks
    .filter((task) => task.status === 'active' && isSnoozed(task, now))
    .sort((a, b) => compareIds(a.title, b.title) || compareIds(a.id, b.id))
}

export interface DailyProgress {
  /** Tasks completed on the local day of `now` (one-off and recurring). */
  readonly done: number
  /** Tasks still on the deck (availableTasks). */
  readonly remaining: number
  /** Tasks snoozed until after today (not counted in remaining). */
  readonly snoozed: number
}

/** "done of done + remaining today". */
export function dailyProgress(tasks: readonly Task[], now: Date): DailyProgress {
  const done = tasks.filter((task) => task.completedAt !== null && isSameLocalDay(task.completedAt, now)).length
  return { done, remaining: availableTasks(tasks, now).length, snoozed: snoozedTasks(tasks, now).length }
}
