import { isAvailable } from './availability.ts'
import { tomorrowKey } from './dates.ts'
import { isRecurring, nextDue } from './recurrence.ts'
import type { Task } from './schemas.ts'
import { isPostponedToday } from './urgency.ts'

/**
 * Swipe right. A one-off task becomes "done"; a recurring task stays active
 * with its next due date and its postpone counters reset.
 * Completing a task that is already done returns it unchanged. Completing
 * always clears a snooze.
 */
export function completeTask(task: Task, now: Date): Task {
  if (task.status === 'done') return task

  const completedAt = now.toISOString()
  if (isRecurring(task)) {
    return { ...task, due: nextDue(task, now), completedAt, skippedAt: null, postponedDays: 0, snoozedUntil: null }
  }
  return { ...task, status: 'done', completedAt, snoozedUntil: null }
}

/**
 * Swipe left: send the card to the bottom of the deck until the end of the day.
 * postponedDays counts days, not swipes: it only grows on the first postpone of a local day.
 */
export function postponeTask(task: Task, now: Date): Task {
  if (task.status === 'done') return task

  return {
    ...task,
    skippedAt: now.toISOString(),
    postponedDays: isPostponedToday(task, now) ? task.postponedDays : task.postponedDays + 1,
  }
}

/**
 * Swipe down ("Tomorrow"): hide the card until the next local day, without
 * touching its due date. Counts like a postpone (skippedAt = now,
 * postponedDays grows only on the first postpone or snooze of the day).
 * Only an active task that is available today can be snoozed; anything
 * else (done, dormant, already snoozed) returns the same reference.
 */
export function snoozeTask(task: Task, now: Date): Task {
  if (task.status !== 'active' || !isAvailable(task, now)) return task
  return { ...postponeTask(task, now), snoozedUntil: tomorrowKey(now) }
}

/** "Bring back today": clears the snooze (same reference when there is none). */
export function unsnoozeTask(task: Task): Task {
  return task.snoozedUntil === null ? task : { ...task, snoozedUntil: null }
}

/** Swipe up. Returns a new array without the task (unchanged content if the id is unknown). */
export function removeTask(tasks: readonly Task[], id: string): Task[] {
  return tasks.filter((task) => task.id !== id)
}

/** Replaces the task with the same id in place, or appends it. Returns a new array. */
export function upsertTask(tasks: readonly Task[], task: Task): Task[] {
  const index = tasks.findIndex((existing) => existing.id === task.id)
  return index === -1 ? [...tasks, task] : tasks.with(index, task)
}
