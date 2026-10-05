import { describe, expect, it } from 'vitest'
import {
  createTask,
  isRecurring,
  nextDue,
  type Due,
  type RecurringTask,
  type TaskInput,
} from '../../src/domain/index.ts'
import { makeTask, NOW } from './fixtures.ts'

type RecurrenceInput = NonNullable<TaskInput['recurrence']>

function recurring(due: Due, recurrence: RecurrenceInput): RecurringTask {
  const task = createTask({ deckId: 'deck-1', title: 'Repeat', due, recurrence }, { id: 'r-1', now: NOW })
  if (!isRecurring(task)) throw new Error('expected a recurring task')
  return task
}

describe('isRecurring', () => {
  it('is true only for tasks with a recurrence', () => {
    expect(isRecurring(recurring({ date: '2026-10-05' }, { unit: 'day', every: 1, anchor: 'due' }))).toBe(true)
    expect(isRecurring(makeTask({ due: { date: '2026-10-05' } }))).toBe(false)
  })
})

describe('nextDue with anchor "due"', () => {
  it.each<[string, Due, RecurrenceInput, string]>([
    ['daily, every 1', { date: '2026-10-05' }, { unit: 'day', every: 1, anchor: 'due' }, '2026-10-06'],
    ['daily, every 3', { date: '2026-10-05' }, { unit: 'day', every: 3, anchor: 'due' }, '2026-10-08'],
    ['weekly, every 1', { date: '2026-10-05' }, { unit: 'week', every: 1, anchor: 'due' }, '2026-10-12'],
    ['weekly, every 2', { date: '2026-10-05' }, { unit: 'week', every: 2, anchor: 'due' }, '2026-10-19'],
    ['monthly, every 1', { date: '2026-10-05' }, { unit: 'month', every: 1, anchor: 'due' }, '2026-11-05'],
    ['monthly, every 3', { date: '2026-10-05' }, { unit: 'month', every: 3, anchor: 'due' }, '2027-01-05'],
  ])('advances one interval from a due date of today (%s)', (_label, due, recurrence, expected) => {
    expect(nextDue(recurring(due, recurrence), NOW)).toEqual({ date: expected })
  })

  it('takes a monthly task due on the 31st to 28 Feb and back to 31 Mar', () => {
    const january = recurring({ date: '2026-01-31' }, { unit: 'month', every: 1, anchor: 'due' })

    const february = nextDue(january, new Date(2026, 0, 31, 9, 0))
    const march = nextDue({ ...january, due: february }, new Date(2026, 1, 28, 9, 0))
    const april = nextDue({ ...january, due: march }, new Date(2026, 2, 31, 9, 0))

    expect([february, march, april]).toEqual([{ date: '2026-02-28' }, { date: '2026-03-31' }, { date: '2026-04-30' }])
  })

  it('lands on 29 Feb in a leap year (2028)', () => {
    const january = recurring({ date: '2028-01-31' }, { unit: 'month', every: 1, anchor: 'due' })

    const february = nextDue(january, new Date(2028, 0, 31, 9, 0))
    const march = nextDue({ ...january, due: february }, new Date(2028, 1, 29, 9, 0))

    expect([february, march]).toEqual([{ date: '2028-02-29' }, { date: '2028-03-31' }])
  })

  it.each<[string, RecurrenceInput, string]>([
    ['daily', { unit: 'day', every: 1, anchor: 'due' }, '2026-10-06'],
    ['every 3 days', { unit: 'day', every: 3, anchor: 'due' }, '2026-10-06'],
    ['every 4 days', { unit: 'day', every: 4, anchor: 'due' }, '2026-10-08'],
    ['weekly', { unit: 'week', every: 1, anchor: 'due' }, '2026-10-07'],
  ])('skips missed occurrences when completed 5 days late (%s)', (_label, recurrence, expected) => {
    // Due on Wed 30 Sep, completed on Mon 5 Oct.
    expect(nextDue(recurring({ date: '2026-09-30' }, recurrence), NOW)).toEqual({ date: expected })
  })

  it('skips missed monthly occurrences and keeps the origin day', () => {
    const task = recurring({ date: '2026-07-31' }, { unit: 'month', every: 2, anchor: 'due' })

    // 31 Jul -> 30 Sep (missed) -> 30 Nov.
    expect(nextDue(task, NOW)).toEqual({ date: '2026-11-30' })
  })

  it('jumps over a long backlog straight to the next future occurrence', () => {
    const task = recurring({ date: '2024-10-05' }, { unit: 'day', every: 1, anchor: 'due' })

    expect(nextDue(task, NOW)).toEqual({ date: '2026-10-06' })
  })

  it('advances one interval from a future due date when completed early', () => {
    expect(nextDue(recurring({ date: '2026-10-10' }, { unit: 'day', every: 1, anchor: 'due' }), NOW)).toEqual({
      date: '2026-10-11',
    })
    expect(nextDue(recurring({ date: '2026-10-10' }, { unit: 'week', every: 1, anchor: 'due' }), NOW)).toEqual({
      date: '2026-10-17',
    })
    expect(nextDue(recurring({ date: '2026-10-10' }, { unit: 'month', every: 1, anchor: 'due' }), NOW)).toEqual({
      date: '2026-11-10',
    })
  })

  it('preserves the time of day', () => {
    const task = recurring({ date: '2026-10-05', time: '07:30' }, { unit: 'week', every: 1, anchor: 'due' })

    expect(nextDue(task, NOW)).toEqual({ date: '2026-10-12', time: '07:30' })
  })

  it('returns a day strictly after today even when the due time is still ahead today', () => {
    const task = recurring({ date: '2026-10-05', time: '22:00' }, { unit: 'day', every: 1, anchor: 'due' })

    expect(nextDue(task, NOW)).toEqual({ date: '2026-10-06', time: '22:00' })
  })
})

describe('nextDue with anchor "completion"', () => {
  it('schedules a weekly task 7 days after today, ignoring an old due date', () => {
    const task = recurring({ date: '2026-09-20' }, { unit: 'week', every: 1, anchor: 'completion' })

    expect(nextDue(task, NOW)).toEqual({ date: '2026-10-12' })
  })

  it('schedules from today even when the due date is in the future', () => {
    const task = recurring({ date: '2026-10-20' }, { unit: 'week', every: 1, anchor: 'completion' })

    expect(nextDue(task, NOW)).toEqual({ date: '2026-10-12' })
  })

  it.each<[RecurrenceInput, string]>([
    [{ unit: 'day', every: 3, anchor: 'completion' }, '2026-10-08'],
    [{ unit: 'week', every: 2, anchor: 'completion' }, '2026-10-19'],
    [{ unit: 'month', every: 1, anchor: 'completion' }, '2026-11-05'],
  ])('adds one interval to today: %o', (recurrence, expected) => {
    expect(nextDue(recurring({ date: '2026-10-01' }, recurrence), NOW)).toEqual({ date: expected })
  })

  it('clamps a monthly completion on 31 Jan to the end of February', () => {
    const task = recurring({ date: '2026-01-31' }, { unit: 'month', every: 1, anchor: 'completion' })

    expect(nextDue(task, new Date(2026, 0, 31, 12, 0))).toEqual({ date: '2026-02-28' })
  })

  it('preserves the time of day', () => {
    const task = recurring({ date: '2026-10-01', time: '18:00' }, { unit: 'day', every: 1, anchor: 'completion' })

    expect(nextDue(task, NOW)).toEqual({ date: '2026-10-06', time: '18:00' })
  })
})
