import { TaskSchema, type Due, type Priority, type Task } from './schemas.ts'

/** The fields a user can edit. Everything else is kept from the task. */
export interface TaskPatch {
  readonly title?: string
  readonly description?: string
  readonly tags?: readonly string[]
  readonly priority?: Priority
  readonly due?: Due | null
  readonly deckId?: string
}

/**
 * Applies an edit and re-validates the task. id, createdAt, status,
 * completedAt, skippedAt, postponedDays and recurrence are preserved; only
 * the listed patch fields are read, whatever else the object carries.
 * Throws ZodError when the result is invalid, e.g. removing the due date of
 * a recurring task.
 *
 * A monthly "due" recurrence keeps its unit, interval and anchor; its
 * originDay follows the new due date when the date changes, so the next
 * occurrences land on the day the user picked.
 */
export function updateTask(task: Task, patch: TaskPatch): Task {
  const due = patch.due === undefined ? task.due : patch.due
  const recurrence =
    task.recurrence?.originDay !== undefined && due !== null && due.date !== task.due?.date
      ? { ...task.recurrence, originDay: Number(due.date.slice(8, 10)) }
      : task.recurrence

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
  })
}
