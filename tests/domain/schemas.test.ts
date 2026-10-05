import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { createTask, DueSchema, RecurrenceSchema, TaskSchema, type TaskInput } from '../../src/domain/index.ts'
import { makeTask, NOW } from './fixtures.ts'

const ctx = { id: 'task-42', now: NOW }

function create(input: Partial<TaskInput> = {}) {
  return createTask({ deckId: 'deck-1', title: 'Pay rent', ...input }, ctx)
}

describe('createTask', () => {
  it('builds an active task with defaults, the injected id and the injected clock', () => {
    const task = create()

    expect(task).toEqual({
      id: 'task-42',
      deckId: 'deck-1',
      title: 'Pay rent',
      description: '',
      tags: [],
      priority: 'medium',
      due: null,
      recurrence: null,
      status: 'active',
      createdAt: NOW.toISOString(),
      completedAt: null,
      skippedAt: null,
      postponedDays: 0,
    })
  })

  it('keeps the provided optional fields', () => {
    const task = create({
      description: 'Before the 10th',
      priority: 'high',
      due: { date: '2026-10-10', time: '18:30' },
    })

    expect(task.description).toBe('Before the 10th')
    expect(task.priority).toBe('high')
    expect(task.due).toEqual({ date: '2026-10-10', time: '18:30' })
  })

  it('returns a frozen task', () => {
    expect(Object.isFrozen(create())).toBe(true)
  })

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['81 characters long', 'x'.repeat(81)],
  ])('rejects a title that is %s', (_label, title) => {
    expect(() => create({ title })).toThrow(ZodError)
  })

  it('accepts a title of exactly 80 characters', () => {
    expect(create({ title: 'x'.repeat(80) }).title).toHaveLength(80)
  })

  it('rejects a description longer than 1000 characters', () => {
    expect(() => create({ description: 'x'.repeat(1001) })).toThrow(ZodError)
  })

  it('normalizes tags: trims, lowercases and removes duplicates keeping the first occurrence order', () => {
    const task = create({ tags: ['  Home ', 'home', 'WORK', 'Errands', 'work '] })

    expect(task.tags).toEqual(['home', 'work', 'errands'])
  })

  it('accepts 10 tags and rejects 11 distinct tags', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `tag${i}`)

    expect(create({ tags: ten }).tags).toHaveLength(10)
    expect(() => create({ tags: [...ten, 'tag10'] })).toThrow(ZodError)
  })

  it('applies the 10-tag limit after removing duplicates', () => {
    const tags = [...Array.from({ length: 10 }, (_, i) => `tag${i}`), 'TAG0']

    expect(create({ tags }).tags).toHaveLength(10)
  })

  it.each([
    ['empty after trimming', '   '],
    ['longer than 20 characters', 'x'.repeat(21)],
  ])('rejects a tag that is %s', (_label, tag) => {
    expect(() => create({ tags: [tag] })).toThrow(ZodError)
  })

  it('fills originDay from the first due date for monthly recurrences anchored on "due"', () => {
    const task = create({
      due: { date: '2026-01-31' },
      recurrence: { unit: 'month', every: 1, anchor: 'due' },
    })

    expect(task.recurrence).toEqual({ unit: 'month', every: 1, anchor: 'due', originDay: 31 })
  })

  it.each([
    ['monthly anchored on completion', { unit: 'month', every: 1, anchor: 'completion' }],
    ['weekly anchored on due', { unit: 'week', every: 1, anchor: 'due' }],
    ['daily anchored on due', { unit: 'day', every: 2, anchor: 'due' }],
  ] as const)('does not set originDay for a %s recurrence', (_label, recurrence) => {
    const task = create({ due: { date: '2026-10-10' }, recurrence })

    expect(task.recurrence).toEqual(recurrence)
  })

  it('rejects a recurrence without a due date', () => {
    expect(() => create({ recurrence: { unit: 'day', every: 1, anchor: 'due' } })).toThrow(ZodError)
  })

  it.each([0, 1.5, -1])('rejects a recurrence with every = %s', (every) => {
    expect(() =>
      create({ due: { date: '2026-10-10' }, recurrence: { unit: 'day', every, anchor: 'due' } }),
    ).toThrow(ZodError)
  })

  it('does not mutate its input', () => {
    const input: TaskInput = Object.freeze({
      deckId: 'deck-1',
      title: 'Pay rent',
      tags: Object.freeze([' A ', 'a']),
      due: Object.freeze({ date: '2026-01-31' }),
      recurrence: Object.freeze({ unit: 'month', every: 1, anchor: 'due' } as const),
    })

    expect(() => createTask(input, ctx)).not.toThrow()
    expect(input.tags).toEqual([' A ', 'a'])
  })
})

describe('DueSchema', () => {
  it.each(['2026-10-05', '2028-02-29', '2026-12-31'])('accepts the real calendar day %s', (date) => {
    expect(DueSchema.safeParse({ date }).success).toBe(true)
  })

  it.each(['2026-02-30', '2026-02-29', '2026-13-01', '2026-00-10', '2026-4-01', '05/10/2026'])(
    'rejects the invalid date %s',
    (date) => {
      expect(DueSchema.safeParse({ date }).success).toBe(false)
    },
  )

  it.each(['00:00', '09:05', '23:59'])('accepts the time %s', (time) => {
    expect(DueSchema.safeParse({ date: '2026-10-05', time }).success).toBe(true)
  })

  it.each(['25:00', '24:00', '12:60', '9:00', '10:00:00'])('rejects the time %s', (time) => {
    expect(DueSchema.safeParse({ date: '2026-10-05', time }).success).toBe(false)
  })
})

describe('RecurrenceSchema', () => {
  it('accepts originDay on a monthly recurrence anchored on "due"', () => {
    const result = RecurrenceSchema.safeParse({ unit: 'month', every: 1, anchor: 'due', originDay: 31 })

    expect(result.success).toBe(true)
  })

  it('requires originDay on a monthly recurrence anchored on "due"', () => {
    expect(RecurrenceSchema.safeParse({ unit: 'month', every: 1, anchor: 'due' }).success).toBe(false)
  })

  it.each([
    { unit: 'week', every: 1, anchor: 'due', originDay: 5 },
    { unit: 'day', every: 1, anchor: 'due', originDay: 5 },
    { unit: 'month', every: 1, anchor: 'completion', originDay: 5 },
  ])('rejects originDay outside monthly "due" recurrences: %o', (recurrence) => {
    expect(RecurrenceSchema.safeParse(recurrence).success).toBe(false)
  })

  it.each([0, 32, 1.5])('rejects originDay = %s', (originDay) => {
    const result = RecurrenceSchema.safeParse({ unit: 'month', every: 1, anchor: 'due', originDay })

    expect(result.success).toBe(false)
  })
})

describe('TaskSchema', () => {
  it('accepts a complete valid task', () => {
    expect(TaskSchema.safeParse(makeTask({ due: { date: '2026-10-05' } })).success).toBe(true)
  })

  it('rejects a recurring task without a due date', () => {
    const result = TaskSchema.safeParse({
      ...makeTask(),
      recurrence: { unit: 'week', every: 1, anchor: 'completion' },
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['recurrence'])
  })

  it('rejects a negative or fractional postponedDays', () => {
    expect(TaskSchema.safeParse({ ...makeTask(), postponedDays: -1 }).success).toBe(false)
    expect(TaskSchema.safeParse({ ...makeTask(), postponedDays: 0.5 }).success).toBe(false)
  })

  it('rejects a createdAt that is not an ISO instant', () => {
    expect(TaskSchema.safeParse({ ...makeTask(), createdAt: '2026-10-05' }).success).toBe(false)
  })
})
