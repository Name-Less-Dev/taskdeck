import { calendarDaysBetween, dueInstant, dueToDate } from './dates.ts'
import type { Due } from './schemas.ts'

/** A due time within this many minutes from now is "soon" (only for dues with a time). */
export const SOON_WINDOW_MINUTES = 180

/** Last calendar day (counted from today) that still belongs to the "week" band. */
export const WEEK_HORIZON_DAYS = 7

export type DueStatus =
  | { readonly kind: 'none' }
  | { readonly kind: 'overdue'; readonly overdueMinutes: number }
  | { readonly kind: 'soon'; readonly inMinutes: number }
  | { readonly kind: 'today' }
  | { readonly kind: 'tomorrow' }
  | { readonly kind: 'week'; readonly inDays: number }
  | { readonly kind: 'later'; readonly inDays: number }

export type DueStatusKind = DueStatus['kind']

const MS_PER_MINUTE = 60_000

/**
 * Classifies a due date relative to `now`.
 * - overdue: the due instant is at or before now (overdueMinutes rounded down).
 * - soon: has a time and is at most SOON_WINDOW_MINUTES away (inMinutes rounded up).
 * - today / tomorrow / week (2-7 days) / later (8+ days): by calendar days.
 */
export function getDueStatus(due: Due | null, now: Date): DueStatus {
  if (due === null) return { kind: 'none' }

  const dueTime = dueInstant(due).getTime()
  const msUntilDue = dueTime - now.getTime()
  if (msUntilDue <= 0) {
    // now - due rather than -msUntilDue, which would yield -0 at the exact deadline.
    return { kind: 'overdue', overdueMinutes: Math.floor((now.getTime() - dueTime) / MS_PER_MINUTE) }
  }

  if (due.time !== undefined && msUntilDue <= SOON_WINDOW_MINUTES * MS_PER_MINUTE) {
    return { kind: 'soon', inMinutes: Math.ceil(msUntilDue / MS_PER_MINUTE) }
  }

  const inDays = calendarDaysBetween(dueToDate(due), now)
  if (inDays <= 0) return { kind: 'today' }
  if (inDays === 1) return { kind: 'tomorrow' }
  if (inDays <= WEEK_HORIZON_DAYS) return { kind: 'week', inDays }
  return { kind: 'later', inDays }
}
