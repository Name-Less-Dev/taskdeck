import { describe, expect, it } from 'vitest'
import { procrastinated } from '../../src/domain/index.ts'
import { deepFreeze, localIso, makeTask } from './fixtures.ts'

describe('procrastinated', () => {
  const tasks = deepFreeze([
    makeTask({ id: 'two', postponedDays: 2 }),
    makeTask({ id: 'three-b', postponedDays: 3 }),
    makeTask({ id: 'five', postponedDays: 5 }),
    makeTask({ id: 'three-a', postponedDays: 3 }),
    makeTask({ id: 'done', postponedDays: 9, status: 'done', completedAt: localIso(2026, 9, 1) }),
  ])

  it('returns active tasks at or above the default threshold of 3, most postponed first, ties by id', () => {
    expect(procrastinated(tasks).map((task) => task.id)).toEqual(['five', 'three-a', 'three-b'])
  })

  it('respects a custom threshold', () => {
    expect(procrastinated(tasks, 2).map((task) => task.id)).toEqual(['five', 'three-a', 'three-b', 'two'])
    expect(procrastinated(tasks, 6)).toEqual([])
  })

  it('excludes done tasks', () => {
    expect(procrastinated(tasks, 0).map((task) => task.id)).not.toContain('done')
  })
})
