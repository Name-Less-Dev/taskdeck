import { z } from 'zod'
import { alignDue } from './weekdays.ts'

export const PRIORITIES = ['low', 'medium', 'high'] as const
export const PrioritySchema = z.enum(PRIORITIES)
export type Priority = z.infer<typeof PrioritySchema>

/** A wall-clock time, "HH:mm" in 24 h (precision -1: no seconds); rejects 24:00 and 12:60. */
export const TimeSchema = z.iso.time({ precision: -1 })

/** True when `value` is a time the domain accepts in a due date. */
export function isValidTime(value: string): boolean {
  return TimeSchema.safeParse(value).success
}

/**
 * A deadline in local wall-clock time, with no time zone attached.
 * Without `time`, the deadline is the end of that local day.
 */
export const DueSchema = z
  .object({
    // z.iso.date() only accepts real calendar days (rejects 2026-02-30).
    date: z.iso.date(),
    time: TimeSchema.optional(),
  })
  .readonly()
export type Due = z.infer<typeof DueSchema>

export const RECURRENCE_UNITS = ['day', 'week', 'month'] as const
export const RECURRENCE_ANCHORS = ['due', 'completion'] as const

/**
 * Days of the week, 0 = Sunday ... 6 = Saturday (Date#getDay). Not empty, no
 * repeats, normalized to ascending order.
 */
export const WeekdaysSchema = z
  .array(z.int().min(0).max(6))
  .min(1)
  .refine((days) => new Set(days).size === days.length, { error: 'weekdays must not repeat' })
  .overwrite((days) => [...days].sort((a, b) => a - b))
  .readonly()

export const RecurrenceSchema = z
  .object({
    unit: z.enum(RECURRENCE_UNITS),
    every: z.int().min(1),
    anchor: z.enum(RECURRENCE_ANCHORS),
    // Day of month of the first deadline, kept so that 31 Jan -> 28 Feb -> 31 Mar.
    originDay: z.int().min(1).max(31).optional(),
    // Optional and additive (schemaVersion stays 1): repeat on these days of the week.
    weekdays: WeekdaysSchema.optional(),
  })
  .refine(
    (r) => (r.originDay !== undefined) === (r.unit === 'month' && r.anchor === 'due'),
    {
      error: 'originDay is required for monthly recurrences anchored on "due" and forbidden otherwise',
      path: ['originDay'],
    },
  )
  .refine((r) => r.weekdays === undefined || (r.unit === 'week' && r.every === 1 && r.anchor === 'due'), {
    // A fixed calendar only: "every 2 weeks on Mon/Wed" or "from completion" are not supported.
    error: 'weekdays need a weekly recurrence, every 1 week, anchored on "due"',
    path: ['weekdays'],
  })
  .readonly()
export type Recurrence = z.infer<typeof RecurrenceSchema>

/** Longest tag, after trimming. */
export const TAG_MAX_LENGTH = 20
/** Most tags a task can carry, after removing duplicates. */
export const MAX_TAGS = 10

export const TagSchema = z.string().trim().toLowerCase().min(1).max(TAG_MAX_LENGTH)

export const TagsSchema = z
  .array(TagSchema)
  .overwrite((tags) => [...new Set(tags)])
  .max(MAX_TAGS)
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
  readonly recurrence?: Pick<Recurrence, 'unit' | 'every' | 'anchor' | 'weekdays'> | null
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
  const recurrence = input.recurrence ?? null
  // With weekdays, the first deadline moves to the first valid day (time kept).
  const due = alignDue(input.due ?? null, recurrence?.weekdays)
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
        : {
            unit: recurrence.unit,
            every: recurrence.every,
            anchor: recurrence.anchor,
            ...(originDay === undefined ? {} : { originDay }),
            ...(recurrence.weekdays === undefined ? {} : { weekdays: recurrence.weekdays }),
          },
    status: 'active',
    createdAt: now.toISOString(),
    completedAt: null,
    skippedAt: null,
    postponedDays: 0,
  })
}
