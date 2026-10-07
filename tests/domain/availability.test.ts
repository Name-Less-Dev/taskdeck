import { describe, expect, it } from 'vitest'
import {
  availableTasks,
  completeTask,
  dailyProgress,
  dormantTasks,
  isAvailable,
  type Recurrence,
  type Task,
} from '../../src/domain/index.ts'
import { deepFreeze, localIso, makeTask, NOW } from './fixtures.ts'

const WEEKLY: Recurrence = { unit: 'week', every: 1, anchor: 'due' }

function recurring(id: string, date: string, overrides: Partial<Task> = {}): Task {
  return makeTask({ id, due: { date }, recurrence: WEEKLY, ...overrides })
}

describe('isAvailable', () => {
  it.each<[name: string, task: Task, expected: boolean]>([
    ['recurring, due yesterday (overdue stays)', recurring('r', '2026-10-04'), true],
    ['recurring, due today', recurring('r', '2026-10-05'), true],
    ['recurring, due today at a later time', recurring('r', '2026-10-05', { due: { date: '2026-10-05', time: '23:00' } }), true],
    ['recurring, due tomorrow (dormant)', recurring('r', '2026-10-06'), false],
    ['recurring, due tomorrow at 00:00 (dormant)', recurring('r', '2026-10-06', { due: { date: '2026-10-06', time: '00:00' } }), false],
    ['one-off, due in the future (only recurring tasks hide)', makeTask({ due: { date: '2026-12-01' } }), true],
    ['one-off, no due date', makeTask(), true],
    ['done one-off', makeTask({ status: 'done', completedAt: localIso(2026, 9, 5, 9) }), false],
  ])('%s -> %s', (_name, task, expected) => {
    expect(isAvailable(deepFreeze(task), NOW)).toBe(expected)
  })

  it('follows the local day of `now` across midnight', () => {
    const task = recurring('r', '2026-10-06')

    expect(isAvailable(task, new Date(2026, 9, 5, 23, 59, 59))).toBe(false)
    expect(isAvailable(task, new Date(2026, 9, 6, 0, 0, 0))).toBe(true)
  })
})

describe('availableTasks and dormantTasks', () => {
  const tasks = deepFreeze([
    makeTask({ id: 'one-off' }),
    recurring('today', '2026-10-05'),
    recurring('later', '2026-10-09'),
    recurring('b-tomorrow', '2026-10-06', { due: { date: '2026-10-06', time: '08:00' } }),
    recurring('a-tomorrow', '2026-10-06', { due: { date: '2026-10-06', time: '08:00' } }),
    recurring('tomorrow-early', '2026-10-06', { due: { date: '2026-10-06', time: '07:00' } }),
    makeTask({ id: 'done', status: 'done', completedAt: localIso(2026, 9, 4, 9) }),
  ])

  it('keeps the available ones in their original order', () => {
    expect(availableTasks(tasks, NOW).map((task) => task.id)).toEqual(['one-off', 'today'])
  })

  it('lists dormant recurring tasks by due instant, then id', () => {
    expect(dormantTasks(tasks, NOW).map((task) => task.id)).toEqual([
      'tomorrow-early',
      'a-tomorrow',
      'b-tomorrow',
      'later',
    ])
  })

  it('splits active tasks with nothing lost or repeated', () => {
    const active = tasks.filter((task) => task.status === 'active')
    const ids = [...availableTasks(tasks, NOW), ...dormantTasks(tasks, NOW)].map((task) => task.id).sort()

    expect(ids).toEqual(active.map((task) => task.id).sort())
  })
})

describe('dailyProgress', () => {
  it('counts what was completed today (one-off and recurring) and what is left', () => {
    const tasks = [
      makeTask({ id: 'done-today', status: 'done', completedAt: localIso(2026, 9, 5, 8) }),
      makeTask({ id: 'done-yesterday', status: 'done', completedAt: localIso(2026, 9, 4, 22) }),
      recurring('rec-done-today', '2026-10-12', { completedAt: localIso(2026, 9, 5, 0, 5) }),
      makeTask({ id: 'left-1' }),
      recurring('left-2', '2026-10-01'),
    ]

    expect(dailyProgress(deepFreeze(tasks), NOW)).toEqual({ done: 2, remaining: 2, snoozed: 0 })
  })

  it('starts a new count at local midnight', () => {
    const tasks = [makeTask({ id: 'x', status: 'done', completedAt: localIso(2026, 9, 5, 23, 30) })]

    expect(dailyProgress(tasks, new Date(2026, 9, 5, 23, 59))).toEqual({ done: 1, remaining: 0, snoozed: 0 })
    expect(dailyProgress(tasks, new Date(2026, 9, 6, 0, 0))).toEqual({ done: 0, remaining: 0, snoozed: 0 })
  })

  it('is zero for nothing', () => {
    expect(dailyProgress([], NOW)).toEqual({ done: 0, remaining: 0, snoozed: 0 })
  })
})

describe('completing tasks and availability', () => {
  it('a recurring task completed today becomes dormant until its next day', () => {
    const task = recurring('r', '2026-10-05')

    const done = completeTask(task, NOW)

    expect(done.due).toEqual({ date: '2026-10-12' })
    expect(isAvailable(done, NOW)).toBe(false)
    expect(isAvailable(done, new Date(2026, 9, 12, 0, 0))).toBe(true)
    expect(dailyProgress([done], NOW)).toEqual({ done: 1, remaining: 0, snoozed: 0 })
  })

  it('completing a dormant task early ("due" anchor) advances from its due date', () => {
    const early = recurring('r', '2026-10-07')

    expect(completeTask(early, NOW).due).toEqual({ date: '2026-10-14' })
  })

  it('completing a dormant task early ("completion" anchor) schedules today + interval', () => {
    const early = recurring('r', '2026-10-07', { recurrence: { unit: 'day', every: 3, anchor: 'completion' } })

    expect(completeTask(early, NOW).due).toEqual({ date: '2026-10-08' })
  })

  it('an overdue recurring task completed today skips the missed days', () => {
    const late = recurring('r', '2026-09-21')

    const done = completeTask(late, NOW)

    expect(done.due).toEqual({ date: '2026-10-12' })
    expect(isAvailable(done, NOW)).toBe(false)
  })
})
