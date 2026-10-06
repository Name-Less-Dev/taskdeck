import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import {
  alignToWeekdays,
  completeTask,
  createTask,
  nextDue,
  RecurrenceSchema,
  TaskSchema,
  updateTask,
  weekdayOf,
  type Due,
  type RecurringTask,
} from '../../src/domain/index.ts'
import { deepFreeze, makeTask, NOW } from './fixtures.ts'

// 5 Oct 2026 (NOW) is a Monday.
const MWF = [1, 3, 5]
const WEEKDAYS = [1, 2, 3, 4, 5]
const WEEKEND = [0, 6]

function weekly(due: Due, weekdays: number[]): RecurringTask {
  const task = makeTask({ due, recurrence: { unit: 'week', every: 1, anchor: 'due', weekdays } })
  if (task.due === null || task.recurrence === null) throw new Error('expected a recurring task')
  return { ...task, due: task.due, recurrence: task.recurrence }
}

/** Local noon of a day, as the completion moment. */
function at(date: string): Date {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0)
}

describe('weekday helpers', () => {
  it('reads the weekday of a local day (0 = Sunday)', () => {
    expect(weekdayOf('2026-10-04')).toBe(0)
    expect(weekdayOf('2026-10-05')).toBe(1)
    expect(weekdayOf('2026-10-10')).toBe(6)
  })

  it.each([
    ['2026-10-05', MWF, '2026-10-05'],
    ['2026-10-06', MWF, '2026-10-07'],
    ['2026-10-10', WEEKDAYS, '2026-10-12'],
    ['2026-10-07', WEEKEND, '2026-10-10'],
  ])('aligns %s to %o -> %s', (date, weekdays, expected) => {
    expect(alignToWeekdays(date, weekdays)).toBe(expected)
  })
})

describe('weekday recurrence: schema invariants', () => {
  const base = { unit: 'week', every: 1, anchor: 'due' } as const

  it('normalizes the days in ascending order', () => {
    expect(RecurrenceSchema.parse({ ...base, weekdays: [5, 1, 3] }).weekdays).toEqual([1, 3, 5])
  })

  it.each<[string, unknown]>([
    ['every 2 weeks', { ...base, every: 2, weekdays: MWF }],
    ['anchored on completion', { ...base, anchor: 'completion', weekdays: MWF }],
    ['daily unit', { ...base, unit: 'day', weekdays: MWF }],
    ['monthly unit', { unit: 'month', every: 1, anchor: 'due', originDay: 5, weekdays: MWF }],
    ['an empty list', { ...base, weekdays: [] }],
    ['repeated days', { ...base, weekdays: [1, 1, 3] }],
    ['a day above 6', { ...base, weekdays: [1, 7] }],
    ['a negative day', { ...base, weekdays: [-1] }],
    ['a fraction', { ...base, weekdays: [1.5] }],
  ])('rejects %s', (_name, recurrence) => {
    expect(() => RecurrenceSchema.parse(recurrence)).toThrow(ZodError)
  })

  it('still loads tasks saved before weekdays existed (no field, schemaVersion 1)', () => {
    const old = {
      ...makeTask({ id: 'old', due: { date: '2026-10-05' } }),
      recurrence: { unit: 'week', every: 1, anchor: 'due' },
    }

    expect(TaskSchema.parse(old).recurrence).toEqual({ unit: 'week', every: 1, anchor: 'due' })
  })
})

describe('weekday recurrence: first due date', () => {
  it('createTask moves the due date to the first valid day, keeping the time', () => {
    const task = createTask(
      {
        deckId: 'deck-1',
        title: 'Academia',
        due: { date: '2026-10-06', time: '07:30' },
        recurrence: { unit: 'week', every: 1, anchor: 'due', weekdays: [5, 1, 3] },
      },
      { id: 'g', now: NOW },
    )

    expect(task.due).toEqual({ date: '2026-10-07', time: '07:30' })
    expect(task.recurrence).toEqual({ unit: 'week', every: 1, anchor: 'due', weekdays: [1, 3, 5] })
  })

  it('keeps a due date that is already on a valid day', () => {
    const task = createTask(
      { deckId: 'd', title: 'x', due: { date: '2026-10-05' }, recurrence: { unit: 'week', every: 1, anchor: 'due', weekdays: MWF } },
      { id: 'g', now: NOW },
    )

    expect(task.due).toEqual({ date: '2026-10-05' })
  })

  it('updateTask aligns when weekdays are set, and when the due date changes later', () => {
    const plain = makeTask({ due: { date: '2026-10-06', time: '18:00' } })

    const set = updateTask(deepFreeze(plain), { recurrence: { unit: 'week', every: 1, anchor: 'due', weekdays: WEEKEND } })
    expect(set.due).toEqual({ date: '2026-10-10', time: '18:00' })

    const moved = updateTask(set, { due: { date: '2026-10-12', time: '18:00' } })
    expect(moved.due).toEqual({ date: '2026-10-17', time: '18:00' })
    expect(moved.recurrence?.weekdays).toEqual([0, 6])
  })

  it('removing the weekdays keeps the plain weekly rule', () => {
    const task = weekly({ date: '2026-10-05' }, MWF)

    expect(updateTask(task, { recurrence: { unit: 'week', every: 1, anchor: 'due' } }).recurrence).toEqual({
      unit: 'week',
      every: 1,
      anchor: 'due',
    })
  })
})

describe('weekday recurrence: next due date', () => {
  it.each<[name: string, due: Due, weekdays: number[], completedOn: string, expected: Due]>([
    ['Mon/Wed/Fri, completed on the day (Mon)', { date: '2026-10-05' }, MWF, '2026-10-05', { date: '2026-10-07' }],
    ['Mon/Wed/Fri, completed early (Wed task on Mon)', { date: '2026-10-07' }, MWF, '2026-10-05', { date: '2026-10-09' }],
    ['Mon/Wed/Fri, completed late (Mon task on Thu)', { date: '2026-10-05' }, MWF, '2026-10-08', { date: '2026-10-09' }],
    ['Mon/Wed/Fri, two weeks late skips the missed days', { date: '2026-10-05' }, MWF, '2026-10-19', { date: '2026-10-21' }],
    ['week turn: Friday -> Monday', { date: '2026-10-09' }, MWF, '2026-10-09', { date: '2026-10-12' }],
    ['weekdays (Mon-Fri), Friday -> Monday', { date: '2026-10-09' }, WEEKDAYS, '2026-10-09', { date: '2026-10-12' }],
    ['weekdays (Mon-Fri), Tuesday -> Wednesday', { date: '2026-10-06' }, WEEKDAYS, '2026-10-06', { date: '2026-10-07' }],
    ['weekend, Saturday -> Sunday', { date: '2026-10-10' }, WEEKEND, '2026-10-10', { date: '2026-10-11' }],
    ['weekend, Sunday -> next Saturday', { date: '2026-10-11' }, WEEKEND, '2026-10-11', { date: '2026-10-17' }],
    ['month turn: Fri 30 Oct -> Mon 2 Nov', { date: '2026-10-30' }, MWF, '2026-10-30', { date: '2026-11-02' }],
    ['year turn: Wed 30 Dec -> Fri 1 Jan', { date: '2026-12-30' }, MWF, '2026-12-30', { date: '2027-01-01' }],
    ['leap day: Tuesdays, 22 Feb 2028 -> 29 Feb 2028', { date: '2028-02-22' }, [2], '2028-02-22', { date: '2028-02-29' }],
    ['keeps the time', { date: '2026-10-05', time: '07:30' }, MWF, '2026-10-05', { date: '2026-10-07', time: '07:30' }],
  ])('%s', (_name, due, weekdays, completedOn, expected) => {
    const task = deepFreeze(weekly(due, weekdays))

    expect(nextDue(task, at(completedOn))).toEqual(expected)
    expect(completeTask(task, at(completedOn)).due).toEqual(expected)
  })

  it('every occurrence falls on one of the chosen days', () => {
    let task = weekly({ date: '2026-10-05' }, MWF)
    const seen: number[] = []
    for (let i = 0; i < 12; i += 1) {
      const next = completeTask(task, at(task.due.date))
      seen.push(weekdayOf(next.due?.date ?? ''))
      task = weekly(next.due ?? { date: '' }, MWF)
    }

    expect(new Set(seen)).toEqual(new Set(MWF))
  })
})
