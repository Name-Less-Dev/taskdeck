import { z } from 'zod'

export const PRIORITIES = ['low', 'medium', 'high'] as const
export const PrioritySchema = z.enum(PRIORITIES)
export type Priority = z.infer<typeof PrioritySchema>

/**
 * A deadline in local wall-clock time, with no time zone attached.
 * Without `time`, the deadline is the end of that local day.
 */
export const DueSchema = z
  .object({
    // z.iso.date() only accepts real calendar days (rejects 2026-02-30).
    date: z.iso.date(),
    // precision -1 means "HH:mm" exactly (no seconds); rejects 25:00.
    time: z.iso.time({ precision: -1 }).optional(),
  })
  .readonly()
export type Due = z.infer<typeof DueSchema>

export const RECURRENCE_UNITS = ['day', 'week', 'month'] as const
export const RECURRENCE_ANCHORS = ['due', 'completion'] as const

export const RecurrenceSchema = z
  .object({
    unit: z.enum(RECURRENCE_UNITS),
    every: z.int().min(1),
    anchor: z.enum(RECURRENCE_ANCHORS),
    // Day of month of the first deadline, kept so that 31 Jan -> 28 Feb -> 31 Mar.
    originDay: z.int().min(1).max(31).optional(),
  })
  .refine(
    (r) => (r.originDay !== undefined) === (r.unit === 'month' && r.anchor === 'due'),
    {
      error: 'originDay is required for monthly recurrences anchored on "due" and forbidden otherwise',
      path: ['originDay'],
    },
  )
  .readonly()
export type Recurrence = z.infer<typeof RecurrenceSchema>

export const TagSchema = z.string().trim().toLowerCase().min(1).max(20)

export const TagsSchema = z
  .array(TagSchema)
  .overwrite((tags) => [...new Set(tags)])
  .max(10)
  .readonly()

export const TASK_STATUSES = ['active', 'done'] as const

export const TaskSchema = z
  .object({
    id: z.string().min(1),
    deckId: z.string().min(1),
    title: z.string().trim().min(1).max(80),
    description: z.string().max(1000).default(''),
    tags: TagsSchema.default([]),
    priority: PrioritySchema.default('medium'),
    due: DueSchema.nullable(),
    recurrence: RecurrenceSchema.nullable(),
    status: z.enum(TASK_STATUSES),
    createdAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    skippedAt: z.iso.datetime().nullable(),
    postponedDays: z.int().min(0),
  })
  .refine((t) => t.recurrence === null || t.due !== null, {
    error: 'a recurring task needs a due date',
    path: ['recurrence'],
  })
  .readonly()
export type Task = z.infer<typeof TaskSchema>

export const DeckSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(30),
  })
  .readonly()
export type Deck = z.infer<typeof DeckSchema>

/** What a caller provides to create a task; the rest is filled by createTask. */
export interface TaskInput {
  readonly deckId: string
  readonly title: string
  readonly description?: string
  readonly tags?: readonly string[]
  readonly priority?: Priority
  readonly due?: Due | null
  readonly recurrence?: Pick<Recurrence, 'unit' | 'every' | 'anchor'> | null
}

export interface CreateTaskContext {
  readonly id: string
  readonly now: Date
}

/**
 * Validates the input and builds a new active task.
 * Throws a ZodError (structured issues, no UI text) when the input is invalid.
 */
export function createTask(input: TaskInput, { id, now }: CreateTaskContext): Task {
  const due = input.due ?? null
  const recurrence = input.recurrence ?? null
  const originDay =
    recurrence?.unit === 'month' && recurrence.anchor === 'due' && due !== null
      ? Number(due.date.slice(8, 10))
      : undefined

  return TaskSchema.parse({
    id,
    deckId: input.deckId,
    title: input.title,
    description: input.description,
    tags: input.tags,
    priority: input.priority,
    due,
    recurrence:
      recurrence === null
        ? null
        : originDay === undefined
          ? { unit: recurrence.unit, every: recurrence.every, anchor: recurrence.anchor }
          : { unit: recurrence.unit, every: recurrence.every, anchor: recurrence.anchor, originDay },
    status: 'active',
    createdAt: now.toISOString(),
    completedAt: null,
    skippedAt: null,
    postponedDays: 0,
  })
}
