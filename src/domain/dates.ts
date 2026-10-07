import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfDay,
  format,
  getDaysInMonth,
  isSameDay,
  parseISO,
} from 'date-fns'
import type { Due } from './schemas.ts'

/** "YYYY-MM-DD" of a local calendar day. */
export type DayKey = string

export type IntervalUnit = 'day' | 'week' | 'month'

const DAY_KEY_FORMAT = 'yyyy-MM-dd'

/** Local calendar day of an instant, as "YYYY-MM-DD". */
export function toDayKey(date: Date): DayKey {
  return format(date, DAY_KEY_FORMAT)
}

/** The local day after the day of `now`, by the calendar (never by adding 24 h). */
export function tomorrowKey(now: Date): DayKey {
  return addToDayKey(toDayKey(now), 'day', 1)
}

function parseNumbers(text: string, separator: string): number[] {
  return text.split(separator).map(Number)
}

/** Local midnight of a "YYYY-MM-DD" day. */
export function dayKeyToDate(key: DayKey): Date {
  const [year = NaN, month = NaN, day = NaN] = parseNumbers(key, '-')
  return new Date(year, month - 1, day)
}

/** The wall-clock moment of a due date in the local zone (midnight when there is no time). */
export function dueToDate(due: Due): Date {
  const date = dayKeyToDate(due.date)
  if (due.time === undefined) return date
  const [hours = 0, minutes = 0] = parseNumbers(due.time, ':')
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes)
}

/** The instant a task becomes overdue: its time, or the end of the local day when there is none. */
export function dueInstant(due: Due): Date {
  const date = dueToDate(due)
  return due.time === undefined ? endOfDay(date) : date
}

/** Calendar-day difference (later - earlier), ignoring the time of day and DST length. */
export function calendarDaysBetween(later: Date, earlier: Date): number {
  return differenceInCalendarDays(later, earlier)
}

/** True when an ISO instant falls on the same local day as `date`. */
export function isSameLocalDay(iso: string, date: Date): boolean {
  return isSameDay(parseISO(iso), date)
}

/** Milliseconds since the epoch of an ISO instant (used for ordering). */
export function isoToTime(iso: string): number {
  return parseISO(iso).getTime()
}

/**
 * Adds `amount` days, weeks or months to a local day.
 * Months clamp to the last day of the target month (31 Jan + 1 month = 28/29 Feb).
 */
export function addToDayKey(key: DayKey, unit: IntervalUnit, amount: number): DayKey {
  const date = dayKeyToDate(key)
  switch (unit) {
    case 'day':
      return toDayKey(addDays(date, amount))
    case 'week':
      return toDayKey(addWeeks(date, amount))
    case 'month':
      return toDayKey(addMonths(date, amount))
  }
}

/**
 * Adds `amount` months to a local day and lands on `day`, clamped to the
 * month length: min(day, lastDayOfMonth).
 */
export function addMonthsOnDay(key: DayKey, amount: number, day: number): DayKey {
  const firstOfMonth = addMonths(dayKeyToDate(key.slice(0, 8) + '01'), amount)
  const clamped = Math.min(day, getDaysInMonth(firstOfMonth))
  return toDayKey(new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), clamped))
}
