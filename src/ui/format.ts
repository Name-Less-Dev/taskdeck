import { dueToDate, type Due, type DueStatus, type Recurrence } from '../domain/index.ts'
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

export function formatRecurrence(recurrence: Recurrence, t: Dictionary): string {
  const base = t.recurrence.every(recurrence.unit, recurrence.every)
  return recurrence.anchor === 'completion' ? base + t.recurrence.fromCompletion : base
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
