import {
  calendarDaysBetween,
  describeRecurrence,
  dueToDate,
  getDueStatus,
  type Due,
  type DueStatus,
  type DueStatusKind,
  type Recurrence,
  type Task,
} from '../domain/index.ts'
import type { Dictionary, Locale } from '../i18n/dictionary.ts'

const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR

/** Turns the structured due status from the domain into a short badge text. */
export function formatDueStatus(status: DueStatus, t: Dictionary): string {
  switch (status.kind) {
    case 'none':
      return t.due.none
    case 'overdue': {
      const minutes = status.overdueMinutes
      if (minutes < 1) return t.due.overdueNow
      if (minutes < MINUTES_PER_HOUR) return t.due.overdueMinutes(minutes)
      if (minutes < MINUTES_PER_DAY) return t.due.overdueHours(Math.floor(minutes / MINUTES_PER_HOUR))
      return t.due.overdueDays(Math.floor(minutes / MINUTES_PER_DAY))
    }
    case 'soon': {
      const minutes = status.inMinutes
      if (minutes < MINUTES_PER_HOUR) return t.due.soonMinutes(minutes)
      return t.due.soonHours(Math.floor(minutes / MINUTES_PER_HOUR), minutes % MINUTES_PER_HOUR)
    }
    case 'today':
      return t.due.today
    case 'tomorrow':
      return t.due.tomorrow
    case 'week':
    case 'later':
      return t.due.inDays(status.inDays)
  }
}

/** Full due date for the back of the card, e.g. "seg., 5 de out., 18:30". */
export function formatDueDate(due: Due | null, locale: Locale, t: Dictionary): string {
  if (due === null) return t.due.none
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(due.time === undefined ? {} : { hour: '2-digit', minute: '2-digit' }),
  })
  return formatter.format(dueToDate(due))
}

/** Every day of the week, 0 = Sunday ... 6 = Saturday (Date#getDay). */
export const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6] as const
export const WORKDAYS: readonly number[] = [1, 2, 3, 4, 5]
export const WEEKEND: readonly number[] = [0, 6]

/** Localized weekday name (Intl), e.g. "seg." / "segunda-feira", "Mon" / "Monday". */
export function weekdayName(day: number, locale: Locale, width: 'short' | 'long'): string {
  // 1 Jan 2023 was a Sunday; UTC so the device zone cannot shift the day.
  return new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + day)))
}

function sameDays(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((day, index) => day === b[index])
}

/** "Dias úteis", "Fins de semana", "Todos os dias", or "seg., qua. e sex.". */
export function formatWeekdays(weekdays: readonly number[], t: Dictionary): string {
  if (sameDays(weekdays, WORKDAYS)) return t.recurrence.workdays
  if (sameDays(weekdays, WEEKEND)) return t.recurrence.weekend
  if (weekdays.length === WEEK_DAYS.length) return t.recurrence.everyDay
  const names = weekdays.map((day) => weekdayName(day, t.locale, 'short'))
  return new Intl.ListFormat(t.locale, { type: 'conjunction' }).format(names)
}

/** Short form for the card's badge: "Toda semana", "A cada 2 semanas", "Dias úteis". */
export function formatRecurrenceShort(recurrence: Recurrence, t: Dictionary): string {
  const { unit, every, weekdays } = describeRecurrence(recurrence)
  if (weekdays !== null) return formatWeekdays(weekdays, t)
  return t.recurrence.every(unit, every)
}

/** Full form for the back of the card: "A cada 2 semanas, contando da conclusão". */
export function formatRecurrence(recurrence: Recurrence, t: Dictionary): string {
  const { anchor, weekdays } = describeRecurrence(recurrence)
  if (weekdays !== null) return t.recurrence.onDays(formatWeekdays(weekdays, t)) + t.recurrence.fromDue
  return (
    formatRecurrenceShort(recurrence, t) +
    (anchor === 'completion' ? t.recurrence.fromCompletion : t.recurrence.fromDue)
  )
}

/** Semantic tone of a due badge; the text always carries the meaning too. */
export type DueTone = 'danger' | 'warning' | 'accent' | 'neutral' | 'muted'

export function dueTone(kind: DueStatus['kind']): DueTone {
  switch (kind) {
    case 'overdue':
      return 'danger'
    case 'soon':
      return 'warning'
    case 'today':
    case 'tomorrow':
      return 'accent'
    case 'week':
    case 'later':
      return 'neutral'
    case 'none':
      return 'muted'
  }
}

/** What the card shows for its due date: text, tone, escalation band and icon. */
export interface DuePresentation {
  readonly text: string
  readonly tone: DueTone
  /** Drives the card's border/background; "pending" is a neutral, non-pulsing style. */
  readonly band: DueStatusKind | 'pending'
  readonly alert: boolean
}

/**
 * A recurring task with a date only is "for that day", not a deadline: on the
 * deck it reads "Today" or "Pending for N days" in a neutral style (no red,
 * no pulse). Everything else (one-off tasks, recurring tasks with a time)
 * keeps the due status and its escalation. getDueStatus itself is unchanged.
 */
export function presentDue(task: Task, now: Date, t: Dictionary): DuePresentation {
  const status = getDueStatus(task.due, now)
  if (task.recurrence !== null && task.due !== null && task.due.time === undefined) {
    const daysLate = calendarDaysBetween(now, dueToDate(task.due))
    if (daysLate >= 1) return { text: t.due.pendingDays(daysLate), tone: 'neutral', band: 'pending', alert: false }
    if (daysLate === 0) return { text: t.due.today, tone: 'neutral', band: 'today', alert: false }
  }
  return { text: formatDueStatus(status, t), tone: dueTone(status.kind), band: status.kind, alert: status.kind === 'overdue' }
}
