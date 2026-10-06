import { describe, expect, it } from 'vitest'
import {
  completeTask,
  describeRecurrence,
  diffDueBands,
  dueBand,
  postponeTask,
  type BandKey,
  type Task,
} from '../../src/domain/index.ts'
import { deepFreeze, localIso, makeTask, NOW } from './fixtures.ts'

const at = (hours: number, minutes = 0) => new Date(2026, 9, 5, hours, minutes)

const soonAt12 = makeTask({ id: 'soon', due: { date: '2026-10-05', time: '12:00' } })
const todayDateOnly = makeTask({ id: 'today', due: { date: '2026-10-05' } })
const noDue = makeTask({ id: 'none' })

function mapOf(entries: Record<string, BandKey>): Map<string, BandKey> {
  return new Map(Object.entries(entries))
}

function changes(previous: Map<string, BandKey>, tasks: readonly Task[], now: Date) {
  return diffDueBands(previous, tasks, now).changes.map(({ task, from, to }) => `${task.id}:${from}->${to}`)
}

describe('diffDueBands', () => {
  it.each<[string, Record<string, BandKey>, readonly Task[], Date, string[]]>([
    ['nothing changes while time stands still', { soon: 'today' }, [soonAt12], at(8), []],
    ['a timed task enters "soon" as time passes', { soon: 'today' }, [soonAt12], at(9, 30), ['soon:today->soon']],
    ['a timed task becomes overdue', { soon: 'soon' }, [soonAt12], at(12), ['soon:soon->overdue']],
    ['a date-only task becomes overdue after midnight', { today: 'today' }, [todayDateOnly], new Date(2026, 9, 6, 0, 0), ['today:today->overdue']],
    ['a task without a due date never changes', { none: 'none' }, [noDue], new Date(2027, 0, 1), []],
    ['a task new to the map is recorded without a change', {}, [soonAt12, todayDateOnly], at(11), []],
    [
      'several tasks change at once, ordered by id',
      { today: 'today', soon: 'today' },
      [todayDateOnly, soonAt12],
      new Date(2026, 9, 6, 0, 0),
      ['soon:today->overdue', 'today:today->overdue'],
    ],
  ])('%s', (_label, previous, tasks, now, expected) => {
    expect(changes(mapOf(previous), tasks, now)).toEqual(expected)
  })

  it('records the band of every active task in the next map', () => {
    const { next } = diffDueBands(new Map(), [soonAt12, todayDateOnly, noDue], at(11))

    expect(Object.fromEntries(next)).toEqual({ soon: 'soon', today: 'today', none: 'none' })
  })

  it('drops completed and deleted tasks from the map without reporting them', () => {
    const done = completeTask(soonAt12, at(11))
    const previous = mapOf({ soon: 'soon', gone: 'overdue' })

    const result = diffDueBands(previous, [done], at(13))

    expect(result.changes).toEqual([])
    expect(result.next.size).toBe(0)
  })

  it('postponing never produces a change', () => {
    const previous = diffDueBands(new Map(), [soonAt12], at(11)).next
    const postponed = postponeTask(soonAt12, at(11))

    expect(diffDueBands(previous, [postponed], at(11)).changes).toEqual([])
  })

  it('a completed recurring task moving to its next date is a band change like any other', () => {
    const weekly = makeTask({ id: 'w', due: { date: '2026-10-04' }, recurrence: { unit: 'week', every: 1, anchor: 'due' } })
    const previous = diffDueBands(new Map(), [weekly], NOW).next

    expect(changes(previous, [completeTask(weekly, NOW)], NOW)).toEqual(['w:overdue->week'])
  })

  it('does not mutate its inputs', () => {
    const previous = deepFreeze(mapOf({ soon: 'today' }))
    const tasks = deepFreeze([soonAt12])

    expect(() => diffDueBands(previous, tasks, at(10))).not.toThrow()
    expect(previous.get('soon')).toBe('today')
  })

  it('exposes the band of a single task', () => {
    expect(dueBand(makeTask({ due: { date: '2026-10-04' }, skippedAt: localIso(2026, 9, 5) }), NOW)).toBe('overdue')
  })
})

describe('describeRecurrence', () => {
  it.each([
    [{ unit: 'week', every: 2, anchor: 'completion' } as const, { unit: 'week', every: 2, anchor: 'completion', monthDay: null }],
    [{ unit: 'month', every: 1, anchor: 'due', originDay: 31 } as const, { unit: 'month', every: 1, anchor: 'due', monthDay: 31 }],
    [{ unit: 'day', every: 1, anchor: 'due' } as const, { unit: 'day', every: 1, anchor: 'due', monthDay: null }],
  ])('describes %o without any text', (recurrence, expected) => {
    expect(describeRecurrence(recurrence)).toEqual(expected)
  })
})
