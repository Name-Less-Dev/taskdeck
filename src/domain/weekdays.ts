import { addToDayKey, dayKeyToDate, type DayKey } from './dates.ts'

/** Day of the week of a local day, 0 = Sunday (Date#getDay). */
export function weekdayOf(key: DayKey): number {
  return dayKeyToDate(key).getDay()
}

/**
 * The first day on or after `key` whose weekday is in `weekdays`. Days
 * outside 0-6 are ignored; with no valid day the key is returned unchanged
 * (the schema rejects such a recurrence anyway).
 */
export function alignToWeekdays(key: DayKey, weekdays: readonly number[]): DayKey {
  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = addToDayKey(key, 'day', offset)
    if (weekdays.includes(weekdayOf(candidate))) return candidate
  }
  return key
}

/** The first day strictly after `key` whose weekday is in `weekdays`. */
export function nextWeekdayAfter(key: DayKey, weekdays: readonly number[]): DayKey {
  return alignToWeekdays(addToDayKey(key, 'day', 1), weekdays)
}

/** A due date moved to the first valid weekday, keeping its time; unchanged without weekdays. */
export function alignDue<T extends { readonly date: DayKey; readonly time?: string }>(
  due: T | null,
  weekdays: readonly number[] | undefined,
): T | null {
  if (due === null || weekdays === undefined) return due
  const date = alignToWeekdays(due.date, weekdays)
  return date === due.date ? due : { ...due, date }
}
