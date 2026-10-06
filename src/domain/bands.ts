import { compareIds } from './compare.ts'
import { getDueStatus, type DueStatusKind } from './due-status.ts'
import type { Recurrence, Task } from './schemas.ts'

/** Urgency band of a task: overdue, soon, today, tomorrow, week, later or none. */
export type BandKey = DueStatusKind

export interface BandChange {
  readonly task: Task
  readonly from: BandKey
  readonly to: BandKey
}

export function dueBand(task: Task, now: Date): BandKey {
  return getDueStatus(task.due, now).kind
}

/**
 * Compares the band of every active task with the previous snapshot.
 * Only tasks already in `previous` can produce a change (a new task is just
 * recorded); tasks that are done or gone leave the map. Postponing does not
 * touch the due date, so it never changes a band. Changes are ordered by id.
 */
export function diffDueBands(
  previous: ReadonlyMap<string, BandKey>,
  tasks: readonly Task[],
  now: Date,
): { next: Map<string, BandKey>; changes: BandChange[] } {
  const next = new Map<string, BandKey>()
  const changes: BandChange[] = []
  for (const task of [...tasks].sort((a, b) => compareIds(a.id, b.id))) {
    if (task.status !== 'active') continue
    const band = dueBand(task, now)
    next.set(task.id, band)
    const before = previous.get(task.id)
    if (before !== undefined && before !== band) changes.push({ task, from: before, to: band })
  }
  return { next, changes }
}

/** Structured description of a recurrence; the UI turns it into words. */
export interface RecurrenceDescription {
  readonly unit: Recurrence['unit']
  readonly every: number
  readonly anchor: Recurrence['anchor']
  /** Day of the month for monthly "due" recurrences, otherwise null. */
  readonly monthDay: number | null
  /** Days of the week (0 = Sunday, ascending) for weekday recurrences, otherwise null. */
  readonly weekdays: readonly number[] | null
}

export function describeRecurrence(recurrence: Recurrence): RecurrenceDescription {
  return {
    unit: recurrence.unit,
    every: recurrence.every,
    anchor: recurrence.anchor,
    monthDay: recurrence.originDay ?? null,
    weekdays: recurrence.weekdays ?? null,
  }
}
