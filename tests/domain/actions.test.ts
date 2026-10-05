import { describe, expect, it } from 'vitest'
import {
  completeTask,
  orderDeck,
  postponeTask,
  removeTask,
  upsertTask,
  type Task,
} from '../../src/domain/index.ts'
import { deepFreeze, localIso, makeTask, NOW } from './fixtures.ts'

describe('completeTask', () => {
  it('marks a one-off task as done at now', () => {
    const task = deepFreeze(makeTask({ due: { date: '2026-10-05' }, postponedDays: 2 }))

    expect(completeTask(task, NOW)).toEqual({ ...task, status: 'done', completedAt: NOW.toISOString() })
  })

  it('keeps a recurring task active with a new due date and reset counters', () => {
    const task = deepFreeze(
      makeTask({
        id: 'weekly',
        due: { date: '2026-10-03', time: '09:00' },
        recurrence: { unit: 'week', every: 1, anchor: 'due' },
        skippedAt: localIso(2026, 9, 5, 8, 0),
        postponedDays: 4,
      }),
    )

    expect(completeTask(task, NOW)).toEqual({
      ...task,
      id: 'weekly',
      status: 'active',
      due: { date: '2026-10-10', time: '09:00' },
      completedAt: NOW.toISOString(),
      skippedAt: null,
      postponedDays: 0,
    })
  })

  it('returns a task that is already done unchanged', () => {
    const done = makeTask({ status: 'done', completedAt: localIso(2026, 9, 1) })

    expect(completeTask(done, NOW)).toBe(done)
  })
})

describe('postponeTask', () => {
  it('records skippedAt and counts the first postpone of the day', () => {
    const task = deepFreeze(makeTask())

    expect(postponeTask(task, NOW)).toEqual({ ...task, skippedAt: NOW.toISOString(), postponedDays: 1 })
  })

  it('counts two postpones on the same day once and moves the card to the bottom again', () => {
    const a = postponeTask(makeTask({ id: 'a' }), new Date(2026, 9, 5, 9, 0))
    const b = postponeTask(makeTask({ id: 'b' }), new Date(2026, 9, 5, 9, 30))
    expect(orderDeck([a, b], NOW).map((task) => task.id)).toEqual(['a', 'b'])

    const aAgain = postponeTask(a, NOW)

    expect(aAgain.postponedDays).toBe(1)
    expect(aAgain.skippedAt).toBe(NOW.toISOString())
    expect(orderDeck([aAgain, b], NOW).map((task) => task.id)).toEqual(['b', 'a'])
  })

  it('counts postpones on two different days as 2', () => {
    const yesterday = postponeTask(makeTask(), new Date(2026, 9, 4, 22, 0))

    expect(postponeTask(yesterday, NOW).postponedDays).toBe(2)
  })

  it('returns a task that is already done unchanged', () => {
    const done = makeTask({ status: 'done', completedAt: localIso(2026, 9, 1) })

    expect(postponeTask(done, NOW)).toBe(done)
  })
})

describe('removeTask and upsertTask', () => {
  const tasks: readonly Task[] = deepFreeze([makeTask({ id: 'a' }), makeTask({ id: 'b' }), makeTask({ id: 'c' })])

  it('removes a task by id into a new array', () => {
    const result = removeTask(tasks, 'b')

    expect(result.map((task) => task.id)).toEqual(['a', 'c'])
    expect(tasks.map((task) => task.id)).toEqual(['a', 'b', 'c'])
  })

  it('returns a new array with the same tasks when the id is unknown', () => {
    const result = removeTask(tasks, 'zzz')

    expect(result).not.toBe(tasks)
    expect(result).toEqual(tasks)
  })

  it('replaces an existing task in place', () => {
    const renamed = makeTask({ id: 'b', title: 'Renamed' })

    const result = upsertTask(tasks, renamed)

    expect(result.map((task) => task.title)).toEqual(['Task', 'Renamed', 'Task'])
    expect(tasks[1]?.title).toBe('Task')
  })

  it('appends a new task', () => {
    const result = upsertTask(tasks, makeTask({ id: 'd' }))

    expect(result.map((task) => task.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(tasks).toHaveLength(3)
  })
})
