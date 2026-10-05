import { dueInstant, isoToTime, isSameLocalDay } from './dates.ts'
import { getDueStatus, type DueStatusKind } from './due-status.ts'
import type { Priority, Task } from './schemas.ts'

/** Urgency bands, most urgent first. */
export const URGENCY_BANDS = [
  'overdue',
  'soon',
  'today',
  'tomorrow',
  'week',
  'later',
  'none',
] as const satisfies readonly DueStatusKind[]

const BAND_RANK: Readonly<Record<DueStatusKind, number>> = {
  overdue: 0,
  soon: 1,
  today: 2,
  tomorrow: 3,
  week: 4,
  later: 5,
  none: 6,
}

const PRIORITY_RANK: Readonly<Record<Priority, number>> = { high: 0, medium: 1, low: 2 }

function compareNumbers(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Code-unit comparison: deterministic and independent of the runtime locale. */
function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function dueTime(task: Task): number {
  return task.due === null ? Number.POSITIVE_INFINITY : dueInstant(task.due).getTime()
}

/**
 * Total order for active cards, most urgent first:
 * band, then priority (high first), then due instant (earliest first, no due last),
 * then createdAt (oldest first), then id.
 */
export function compareUrgency(a: Task, b: Task, now: Date): number {
  return (
    compareNumbers(BAND_RANK[getDueStatus(a.due, now).kind], BAND_RANK[getDueStatus(b.due, now).kind]) ||
    compareNumbers(PRIORITY_RANK[a.priority], PRIORITY_RANK[b.priority]) ||
    compareNumbers(dueTime(a), dueTime(b)) ||
    compareNumbers(isoToTime(a.createdAt), isoToTime(b.createdAt)) ||
    compareIds(a.id, b.id)
  )
}

/** True when the task was sent to the bottom of the deck on the local day of `now`. */
export function isPostponedToday(task: Task, now: Date): boolean {
  return task.skippedAt !== null && isSameLocalDay(task.skippedAt, now)
}

interface PostponedCard {
  readonly task: Task
  readonly skippedTime: number
}

/**
 * The deck as the user sees it: only active tasks; first those not postponed
 * today (by urgency), then those postponed today (by skippedAt, then id).
 * Returns a new array.
 */
export function orderDeck(tasks: readonly Task[], now: Date): Task[] {
  const fresh: Task[] = []
  const postponed: PostponedCard[] = []
  for (const task of tasks) {
    if (task.status !== 'active') continue
    if (task.skippedAt !== null && isSameLocalDay(task.skippedAt, now)) {
      postponed.push({ task, skippedTime: isoToTime(task.skippedAt) })
    } else {
      fresh.push(task)
    }
  }

  fresh.sort((a, b) => compareUrgency(a, b, now))
  postponed.sort((a, b) => compareNumbers(a.skippedTime, b.skippedTime) || compareIds(a.task.id, b.task.id))
  return [...fresh, ...postponed.map((card) => card.task)]
}

/** The card on top of the deck, or null when there is nothing active. */
export function topCard(tasks: readonly Task[], now: Date): Task | null {
  return orderDeck(tasks, now)[0] ?? null
}
