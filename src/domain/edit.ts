import { TaskSchema, type Due, type Priority, type Recurrence, type Task } from './schemas.ts'
import { alignDue } from './weekdays.ts'

/** A recurrence as the user edits it; originDay is derived, never typed in. */
export type RecurrenceInput = Pick<Recurrence, 'unit' | 'every' | 'anchor' | 'weekdays'>

/** The fields a user can edit. Everything else is kept from the task. */
export interface TaskPatch {
  readonly title?: string
  readonly description?: string
  readonly tags?: readonly string[]
  readonly priority?: Priority
  readonly due?: Due | null
  readonly deckId?: string
  /** undefined = keep, null = remove, object = set (validated by the schema). */
  readonly recurrence?: RecurrenceInput | null
}

function dayOfMonth(due: Due): number {
  return Number(due.date.slice(8, 10))
}

/** originDay only exists for monthly recurrences anchored on the due date. */
function usesOriginDay(recurrence: RecurrenceInput): boolean {
  return recurrence.unit === 'month' && recurrence.anchor === 'due'
}

/**
 * The recurrence after the edit:
 * - kept (patch undefined): a monthly "due" recurrence follows a new due date;
 * - removed (null);
 * - set (object): originDay is derived from the due date in force when it
 *   applies (monthly + "due") and dropped otherwise. When the task already had
 *   a monthly "due" recurrence and the due date did not change, its originDay
 *   is kept, so a clamped date (28 Feb for a "31st" task) does not lose the 31.
 */
function nextRecurrence(task: Task, patch: TaskPatch, due: Due | null): Recurrence | null {
  const dueChanged = due?.date !== task.due?.date

  if (patch.recurrence === undefined) {
    const current = task.recurrence
    if (current?.originDay === undefined || due === null || !dueChanged) return current
    return { ...current, originDay: dayOfMonth(due) }
  }
  if (patch.recurrence === null) return null

  const { unit, every, anchor, weekdays } = patch.recurrence
  const base = { unit, every, anchor, ...(weekdays === undefined ? {} : { weekdays }) }
  if (!usesOriginDay(patch.recurrence) || due === null) return base
  const kept = dueChanged ? undefined : task.recurrence?.originDay
  return { ...base, originDay: kept ?? dayOfMonth(due) }
}

/**
 * Applies an edit and re-validates the task. id, createdAt, status,
 * completedAt, skippedAt, postponedDays and snoozedUntil are preserved; only the listed
 * patch fields are read, whatever else the object carries.
 * Throws ZodError when the result is invalid, e.g. a recurrence without a due
 * date (removing the due date is fine if the same patch removes the recurrence).
 * With weekdays, the due date moves to the first valid weekday (time kept).
 */
export function updateTask(task: Task, patch: TaskPatch): Task {
  const requested = patch.due === undefined ? task.due : patch.due
  const recurrence = nextRecurrence(task, patch, requested)
  const due = alignDue(requested, recurrence?.weekdays)

  return TaskSchema.parse({
    id: task.id,
    deckId: patch.deckId ?? task.deckId,
    title: patch.title ?? task.title,
    description: patch.description ?? task.description,
    tags: patch.tags ?? task.tags,
    priority: patch.priority ?? task.priority,
    due,
    recurrence,
    status: task.status,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
    skippedAt: task.skippedAt,
    postponedDays: task.postponedDays,
    snoozedUntil: task.snoozedUntil,
  })
}
