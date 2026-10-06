import { addToDayKey, compareTasksById, type Due, type Priority, type Recurrence, type Task } from './deps.ts'

/**
 * iCalendar (RFC 5545) export. Pure: no DOM, no clock (`now` is a parameter),
 * no UI text of its own (labels come from the caller).
 *
 * - One VEVENT per active task with a due date (VEVENT, not VTODO: calendar
 *   apps on phones show and alert on events; most ignore VTODO).
 * - UID "<task.id>@taskdeck" is stable, so importing again updates instead of
 *   duplicating; DTSTAMP is `now` in UTC (RFC 5545 3.8.7.2).
 * - Date-only due: all-day event (DTSTART;VALUE=DATE, DTEND the next day,
 *   non-inclusive). Due with a time: floating local time (no Z, no TZID,
 *   RFC 5545 3.3.5 form #1), lasting 15 minutes (DURATION:PT15M).
 * - PRIORITY: high 1, medium 5, low 9 (RFC 5545 3.8.1.9: 1-4 high, 5 medium, 6-9 low).
 * - Recurrence anchored on the due date becomes an RRULE. Monthly rules:
 *   day 1-28 -> BYMONTHDAY=N; day 31 -> BYMONTHDAY=-1 (the last day, which is
 *   exactly "31, or the last day of a shorter month"). Days 29 and 30 have an
 *   RFC-exact form (BYMONTHDAY=28..N;BYSETPOS=-1), but ical.js 2.2.1 ignores
 *   BYSETPOS there and expands every listed day (checked in the parser
 *   tests), so it is not portable: only the next date is exported, with a note.
 *   Recurrence anchored on completion has no calendar equivalent either: only
 *   the next occurrence is exported and DESCRIPTION says so.
 * - Lines end in CRLF and are folded at 75 octets without splitting a UTF-8
 *   sequence (3.1); TEXT escapes backslash, semicolon, comma and newlines (3.3.11).
 */

export const ALARM_OPTIONS = ['none', 'at-time', '15m', '1h', '1d'] as const
export type AlarmOption = (typeof ALARM_OPTIONS)[number]

/** Texts written into the file, provided by the UI in the user's language. */
export interface IcsLabels {
  readonly priority: string
  readonly priorities: Readonly<Record<Priority, string>>
  readonly deck: string
  /** Added to DESCRIPTION for recurrences anchored on completion (no RRULE). */
  readonly completionRecurrenceNote: string
  /** Added to DESCRIPTION for monthly recurrences on day 29 or 30 (no portable RRULE). */
  readonly monthEndRecurrenceNote: (day: number) => string
}

export interface IcsOptions {
  readonly now: Date
  readonly alarm: AlarmOption
  readonly labels: IcsLabels
  /** Deck name for a task's deckId (undefined if unknown). */
  readonly deckName: (deckId: string) => string | undefined
}

const CRLF = '\r\n'
const MAX_OCTETS = 75
export const TIMED_EVENT_DURATION = 'PT15M'
/** All-day events: alarms fire at 09:00 of the day (relative to its 00:00). */
const ALL_DAY_ALARM_HOUR = 9

const ICS_PRIORITY: Readonly<Record<Priority, number>> = { high: 1, medium: 5, low: 9 }

/** TEXT value escaping (RFC 5545 3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1
  if (codePoint < 0x800) return 2
  if (codePoint < 0x10000) return 3
  return 4
}

/**
 * Folds a content line into chunks of at most 75 octets (UTF-8), each
 * continuation starting with a space, never inside a character's bytes.
 */
export function foldLine(line: string): string {
  const out: string[] = []
  let current = ''
  let octets = 0
  for (const char of line) {
    const size = utf8Length(char.codePointAt(0) ?? 0)
    // Continuation lines spend one octet on the leading space.
    const limit = out.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1
    if (octets + size > limit) {
      out.push(current)
      current = ''
      octets = 0
    }
    current += char
    octets += size
  }
  out.push(current)
  return out.join(`${CRLF} `)
}

function compactDate(date: string): string {
  return date.replace(/-/g, '')
}

function floatingDateTime(due: Due & { time: string }): string {
  return `${compactDate(due.date)}T${due.time.replace(':', '')}00`
}

function utcStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function monthDay(recurrence: Recurrence, due: Due): number {
  return recurrence.originDay ?? Number(due.date.slice(8, 10))
}

/** RRULE for a recurrence anchored on the due date; null when it has no exact, portable equivalent. */
export function recurrenceRule(recurrence: Recurrence, due: Due): string | null {
  if (recurrence.anchor !== 'due') return null
  const interval = `INTERVAL=${recurrence.every}`
  switch (recurrence.unit) {
    case 'day':
      return `FREQ=DAILY;${interval}`
    case 'week':
      return `FREQ=WEEKLY;${interval}`
    case 'month': {
      const day = monthDay(recurrence, due)
      if (day <= 28) return `FREQ=MONTHLY;${interval};BYMONTHDAY=${day}`
      if (day === 31) return `FREQ=MONTHLY;${interval};BYMONTHDAY=-1`
      return null
    }
  }
}

function alarmTrigger(alarm: AlarmOption, allDay: boolean): string | null {
  if (alarm === 'none') return null
  if (allDay) return alarm === '1d' ? `-PT${24 - ALL_DAY_ALARM_HOUR}H` : `PT${ALL_DAY_ALARM_HOUR}H`
  switch (alarm) {
    case 'at-time':
      return 'PT0S'
    case '15m':
      return '-PT15M'
    case '1h':
      return '-PT1H'
    case '1d':
      return '-P1D'
  }
}

function eventLines(task: Task & { due: Due }, options: IcsOptions): string[] {
  const { due } = task
  const { labels } = options
  const lines = ['BEGIN:VEVENT', `UID:${escapeText(task.id)}@taskdeck`, `DTSTAMP:${utcStamp(options.now)}`]

  const allDay = due.time === undefined
  if (due.time === undefined) {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(due.date)}`, `DTEND;VALUE=DATE:${compactDate(addToDayKey(due.date, 'day', 1))}`)
  } else {
    lines.push(`DTSTART:${floatingDateTime({ ...due, time: due.time })}`, `DURATION:${TIMED_EVENT_DURATION}`)
  }

  const rule = task.recurrence === null ? null : recurrenceRule(task.recurrence, due)
  if (rule !== null) lines.push(`RRULE:${rule}`)

  lines.push(`SUMMARY:${escapeText(task.title)}`)
  const details = [
    `${labels.priority}: ${labels.priorities[task.priority]}`,
    ...(options.deckName(task.deckId) === undefined ? [] : [`${labels.deck}: ${options.deckName(task.deckId) ?? ''}`]),
    ...(task.recurrence !== null && rule === null
      ? [
          task.recurrence.anchor === 'completion'
            ? labels.completionRecurrenceNote
            : labels.monthEndRecurrenceNote(monthDay(task.recurrence, due)),
        ]
      : []),
  ]
  const description = [task.description, details.join('\n')].filter((part) => part !== '').join('\n\n')
  lines.push(`DESCRIPTION:${escapeText(description)}`)
  if (task.tags.length > 0) lines.push(`CATEGORIES:${task.tags.map(escapeText).join(',')}`)
  lines.push(`PRIORITY:${ICS_PRIORITY[task.priority]}`)

  const trigger = alarmTrigger(options.alarm, allDay)
  if (trigger !== null) {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(task.title)}`, `TRIGGER:${trigger}`, 'END:VALARM')
  }
  lines.push('END:VEVENT')
  return lines
}

function hasDue(task: Task): task is Task & { due: Due } {
  return task.due !== null
}

/**
 * Builds the .ics text for every active task with a due date, ordered by id.
 * With no such task the calendar has no VEVENT: parsers accept it, but the
 * RFC grammar asks for at least one component, so callers should not offer
 * an empty download.
 */
export function buildIcs(tasks: readonly Task[], options: IcsOptions): string {
  const events = tasks
    .filter((task) => task.status === 'active')
    .filter(hasDue)
    .sort(compareTasksById)
    .flatMap((task) => eventLines(task, options))

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//taskdeck//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR']
  return lines.map(foldLine).join(CRLF) + CRLF
}

/** Counts the tasks buildIcs would export. */
export function exportableCount(tasks: readonly Task[]): number {
  return tasks.filter((task) => task.status === 'active' && task.due !== null).length
}

/** "taskdeck-YYYY-MM-DD.ics" with the local date. */
export function icsFileName(dayKey: string): string {
  return `taskdeck-${dayKey}.ics`
}
