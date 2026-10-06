import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { updateTask, type Recurrence, type Task, type TaskPatch } from '../../src/domain/index.ts'
import { deepFreeze, makeTask } from './fixtures.ts'

const oneOff: Task = deepFreeze(makeTask({ id: 'o', due: { date: '2026-10-07', time: '09:00' } }))
const noDue: Task = deepFreeze(makeTask({ id: 'n' }))
const weekly: Task = deepFreeze(
  makeTask({ id: 'w', due: { date: '2026-10-07' }, recurrence: { unit: 'week', every: 1, anchor: 'due' } }),
)
const monthly31: Task = deepFreeze(
  makeTask({ id: 'm', due: { date: '2026-02-28' }, recurrence: { unit: 'month', every: 1, anchor: 'due', originDay: 31 } }),
)

describe('updateTask: editing the recurrence', () => {
  it.each<[string, Task, TaskPatch, Recurrence | null]>([
    ['keeps it when the patch has no recurrence key', weekly, { title: 'x' }, { unit: 'week', every: 1, anchor: 'due' }],
    ['sets a daily recurrence on a one-off task', oneOff, { recurrence: { unit: 'day', every: 3, anchor: 'due' } }, { unit: 'day', every: 3, anchor: 'due' }],
    [
      'sets a monthly "due" recurrence with originDay from the due date',
      oneOff,
      { recurrence: { unit: 'month', every: 1, anchor: 'due' } },
      { unit: 'month', every: 1, anchor: 'due', originDay: 7 },
    ],
    [
      'derives originDay from a due date changed in the same patch',
      oneOff,
      { due: { date: '2026-10-31' }, recurrence: { unit: 'month', every: 2, anchor: 'due' } },
      { unit: 'month', every: 2, anchor: 'due', originDay: 31 },
    ],
    ['changes the interval', weekly, { recurrence: { unit: 'week', every: 2, anchor: 'due' } }, { unit: 'week', every: 2, anchor: 'due' }],
    [
      'switching to "completion" drops originDay',
      monthly31,
      { recurrence: { unit: 'month', every: 1, anchor: 'completion' } },
      { unit: 'month', every: 1, anchor: 'completion' },
    ],
    [
      'switching from monthly to weekly drops originDay',
      monthly31,
      { recurrence: { unit: 'week', every: 1, anchor: 'due' } },
      { unit: 'week', every: 1, anchor: 'due' },
    ],
    [
      'resubmitting the same monthly recurrence keeps a clamped originDay (31 on 28 Feb)',
      monthly31,
      { recurrence: { unit: 'month', every: 1, anchor: 'due' } },
      { unit: 'month', every: 1, anchor: 'due', originDay: 31 },
    ],
    [
      'a new due date resets originDay even when resubmitting the same monthly recurrence',
      monthly31,
      { due: { date: '2026-03-15' }, recurrence: { unit: 'month', every: 1, anchor: 'due' } },
      { unit: 'month', every: 1, anchor: 'due', originDay: 15 },
    ],
    [
      'a weekly task turned monthly takes the due day',
      weekly,
      { recurrence: { unit: 'month', every: 1, anchor: 'due' } },
      { unit: 'month', every: 1, anchor: 'due', originDay: 7 },
    ],
    ['removes it with null', weekly, { recurrence: null }, null],
    ['removes the recurrence and the due date in the same patch', weekly, { recurrence: null, due: null }, null],
  ])('%s', (_label, task, patch, expected) => {
    expect(updateTask(task, patch).recurrence).toEqual(expected)
  })

  it.each<[string, Task, TaskPatch]>([
    ['setting a recurrence on a task without a due date', noDue, { recurrence: { unit: 'week', every: 1, anchor: 'due' } }],
    ['removing the due date while the recurrence stays', weekly, { due: null }],
    ['removing the due date while setting a recurrence', oneOff, { due: null, recurrence: { unit: 'day', every: 1, anchor: 'due' } }],
    ['every = 0', weekly, { recurrence: { unit: 'week', every: 0, anchor: 'due' } }],
    ['a fractional interval', weekly, { recurrence: { unit: 'week', every: 1.5, anchor: 'due' } }],
  ])('rejects %s', (_label, task, patch) => {
    expect(() => updateTask(task, patch)).toThrow(ZodError)
  })

  it('keeps counters and status when the recurrence changes', () => {
    const counted = makeTask({ due: { date: '2026-10-07' }, postponedDays: 3, recurrence: { unit: 'day', every: 1, anchor: 'due' } })

    expect(updateTask(counted, { recurrence: { unit: 'week', every: 1, anchor: 'completion' } })).toMatchObject({
      postponedDays: 3,
      status: 'active',
      due: { date: '2026-10-07' },
    })
  })

  it('does not mutate the task', () => {
    updateTask(weekly, { recurrence: null })

    expect(weekly.recurrence).toEqual({ unit: 'week', every: 1, anchor: 'due' })
  })
})
