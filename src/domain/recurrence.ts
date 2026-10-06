import { addMonthsOnDay, addToDayKey, calendarDaysBetween, dayKeyToDate, toDayKey, type DayKey } from './dates.ts'
import type { Due, Recurrence, Task } from './schemas.ts'
import { nextWeekdayAfter } from './weekdays.ts'

/** A task that repeats; the schema guarantees a recurring task has a due date. */
export type RecurringTask = Task & { readonly due: Due; readonly recurrence: Recurrence }

export function isRecurring(task: Task): task is RecurringTask {
  return task.recurrence !== null && task.due !== null
}

function dayOfMonth(key: DayKey): number {
  return Number(key.slice(8, 10))
}

/** The k-th occurrence after `start` (k >= 1) for an anchor-"due" recurrence. */
function occurrence(start: DayKey, recurrence: Recurrence, k: number): DayKey {
  const amount = k * recurrence.every
  if (recurrence.unit === 'month') {
    return addMonthsOnDay(start, amount, recurrence.originDay ?? dayOfMonth(start))
  }
  return addToDayKey(start, recurrence.unit, amount)
}

/** Whole units (days, weeks or months) from `start` to `today`; negative when start is in the future. */
function unitsBehind(start: DayKey, today: DayKey, unit: Recurrence['unit']): number {
  if (unit === 'month') {
    const [startYear, startMonth] = [Number(start.slice(0, 4)), Number(start.slice(5, 7))]
    const [todayYear, todayMonth] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))]
    return (todayYear - startYear) * 12 + (todayMonth - startMonth)
  }
  const days = calendarDaysBetween(dayKeyToDate(today), dayKeyToDate(start))
  return unit === 'week' ? Math.floor(days / 7) : days
}

/** First occurrence after `start` that falls strictly after `today`, skipping missed ones. */
function firstOccurrenceAfter(start: DayKey, recurrence: Recurrence, today: DayKey): DayKey {
  // Jump close to today first so long-overdue tasks don't iterate over every missed occurrence.
  let k = Math.max(1, Math.floor(unitsBehind(start, today, recurrence.unit) / recurrence.every))
  let candidate = occurrence(start, recurrence, k)
  // "YYYY-MM-DD" strings compare in calendar order.
  while (candidate <= today) {
    k += 1
    candidate = occurrence(start, recurrence, k)
  }
  return candidate
}

/**
 * The due date of the next occurrence, always on a local day strictly after
 * the day of `now`. The time of day, if any, is preserved.
 * - anchor "due": current due + 1 interval, skipping occurrences already missed.
 * - anchor "completion": today + 1 interval.
 * Monthly "due" recurrences land on min(originDay, last day of the month).
 * With weekdays: the first valid weekday strictly after max(current due,
 * today), so missed days are skipped and completing early moves on from the
 * due date.
 */
export function nextDue(task: RecurringTask, now: Date): Due {
  const { due, recurrence } = task
  const today = toDayKey(now)
  const date =
    recurrence.weekdays !== undefined
      ? nextWeekdayAfter(due.date > today ? due.date : today, recurrence.weekdays)
      : recurrence.anchor === 'completion'
        ? addToDayKey(today, recurrence.unit, recurrence.every)
        : firstOccurrenceAfter(due.date, recurrence, today)

  return due.time === undefined ? { date } : { date, time: due.time }
}
