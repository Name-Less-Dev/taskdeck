import { diffDueBands, type BandChange, type BandKey, type Task } from '../domain/index.ts'

/**
 * Pure rules for in-app due reminders (the app must be open; there are no
 * system notifications yet). A reminder fires when the passage of time moves
 * a task into "soon" or "overdue":
 * - nothing on the first run (initial load);
 * - simultaneous changes become one grouped reminder;
 * - changes while the page is hidden are collected and summarized once when
 *   it becomes visible again;
 * - the same task never triggers the same band twice (until it leaves it,
 *   e.g. rescheduled after completion);
 * - a band change caused by editing the due date is not a reminder.
 */

export type ReminderBand = 'soon' | 'overdue'

export type Reminder =
  | { readonly kind: 'single'; readonly task: Task; readonly band: ReminderBand }
  | { readonly kind: 'group'; readonly count: number }
  | { readonly kind: 'away'; readonly count: number; readonly allOverdue: boolean }

export interface ReminderState {
  /** null until the first step: the initial load never reminds. */
  readonly bands: ReadonlyMap<string, BandKey> | null
  /** Due date seen for each task, to tell time passing from an edit. */
  readonly dues: ReadonlyMap<string, string>
  /** "<id>:<band>" already reminded (or queued while hidden). */
  readonly notified: ReadonlySet<string>
  /** Changes collected while the page was hidden. */
  readonly away: readonly BandChange[]
}

export const INITIAL_REMINDERS: ReminderState = { bands: null, dues: new Map(), notified: new Set(), away: [] }

function isReminderBand(band: BandKey): band is ReminderBand {
  return band === 'soon' || band === 'overdue'
}

function dueKey(task: Task): string {
  return task.due === null ? '' : `${task.due.date}T${task.due.time ?? ''}`
}

export function reminderStep(
  state: ReminderState,
  tasks: readonly Task[],
  now: Date,
  visible: boolean,
): { state: ReminderState; reminder: Reminder | null } {
  const { next, changes } = diffDueBands(state.bands ?? new Map(), tasks, now)
  const dues = new Map(tasks.map((task) => [task.id, dueKey(task)]))
  if (state.bands === null) {
    return { state: { bands: next, dues, notified: new Set(), away: [] }, reminder: null }
  }

  const notified = new Set(state.notified)
  // A task that left a band may be reminded about it again later.
  for (const change of changes) {
    if (isReminderBand(change.from)) notified.delete(`${change.task.id}:${change.from}`)
  }

  const fresh = changes.filter((change) => {
    if (!isReminderBand(change.to)) return false
    if (state.dues.get(change.task.id) !== dues.get(change.task.id)) return false
    const key = `${change.task.id}:${change.to}`
    if (notified.has(key)) return false
    notified.add(key)
    return true
  })

  if (!visible) {
    return { state: { bands: next, dues, notified, away: [...state.away, ...fresh] }, reminder: null }
  }

  const base: ReminderState = { bands: next, dues, notified, away: [] }
  if (state.away.length > 0) {
    // Only what is still in a reminder band counts in the summary.
    const pending = [...state.away, ...fresh].filter((change) => next.get(change.task.id) === change.to)
    if (pending.length === 0) return { state: base, reminder: null }
    return {
      state: base,
      reminder: { kind: 'away', count: pending.length, allOverdue: pending.every((change) => change.to === 'overdue') },
    }
  }

  const [only] = fresh
  if (only === undefined) return { state: base, reminder: null }
  if (fresh.length > 1) return { state: base, reminder: { kind: 'group', count: fresh.length } }
  return { state: base, reminder: { kind: 'single', task: only.task, band: only.to as ReminderBand } }
}
