import { describe, expect, it } from 'vitest'
import {
  availableTasks,
  completeTask,
  dailyProgress,
  dormantTasks,
  isAvailable,
  isSnoozed,
  postponeTask,
  snoozedTasks,
  snoozeTask,
  TaskSchema,
  tomorrowKey,
  unsnoozeTask,
  type Task,
} from '../../src/domain/index.ts'
import { parseBackup } from '../../src/storage/index.ts'
import { context } from '../storage/helpers.ts'
import { deepFreeze, localIso, makeTask, NOW } from './fixtures.ts'

const WEEKLY = { unit: 'week', every: 1, anchor: 'due' } as const

describe('tomorrowKey', () => {
  it.each<[string, Date, string]>([
    ['an ordinary day', NOW, '2026-10-06'],
    ['just before midnight', new Date(2026, 9, 5, 23, 59, 59), '2026-10-06'],
    ['month turn', new Date(2026, 9, 31, 12, 0), '2026-11-01'],
    ['year turn', new Date(2026, 11, 31, 18, 0), '2027-01-01'],
    ['into a leap day', new Date(2028, 1, 28, 9, 0), '2028-02-29'],
    ['out of a leap day', new Date(2028, 1, 29, 9, 0), '2028-03-01'],
  ])('%s', (_name, now, expected) => {
    expect(tomorrowKey(now)).toBe(expected)
  })
})

describe('snoozeTask and the way back', () => {
  it.each<[string, Date, Date]>([
    ['midnight', NOW, new Date(2026, 9, 6, 0, 0)],
    ['month turn', new Date(2026, 9, 31, 20, 0), new Date(2026, 10, 1, 0, 0)],
    ['year turn', new Date(2026, 11, 31, 20, 0), new Date(2027, 0, 1, 0, 0)],
    ['leap day', new Date(2028, 1, 28, 20, 0), new Date(2028, 1, 29, 0, 0)],
  ])('hides the card until the next local day (%s)', (_name, now, nextDay) => {
    const snoozed = snoozeTask(deepFreeze(makeTask()), now)

    expect(isSnoozed(snoozed, now)).toBe(true)
    expect(isAvailable(snoozed, now)).toBe(false)
    expect(isAvailable(snoozed, new Date(nextDay.getTime() - 1000))).toBe(false)
    expect(isAvailable(snoozed, nextDay)).toBe(true)
    expect(isSnoozed(snoozed, nextDay)).toBe(false)
  })

  it('never touches the due date', () => {
    const task = makeTask({ due: { date: '2026-10-05', time: '18:00' } })

    expect(snoozeTask(task, NOW).due).toEqual({ date: '2026-10-05', time: '18:00' })
  })

  it.each<[string, Task]>([
    ['already snoozed', makeTask({ snoozedUntil: '2026-10-06' })],
    ['done', makeTask({ status: 'done', completedAt: localIso(2026, 9, 5, 9) })],
    ['dormant recurring (its day is later)', makeTask({ due: { date: '2026-10-07' }, recurrence: WEEKLY })],
  ])('returns the same reference for a task that is %s', (_name, task) => {
    const frozen = deepFreeze(task)

    expect(snoozeTask(frozen, NOW)).toBe(frozen)
  })

  it('snoozing twice on the same day changes nothing the second time', () => {
    const once = snoozeTask(makeTask(), NOW)

    expect(snoozeTask(once, new Date(2026, 9, 5, 22, 0))).toBe(once)
  })

  it('treats a past snoozedUntil as no snooze (harmless), so it can be snoozed again', () => {
    const stale = deepFreeze(makeTask({ snoozedUntil: '2026-10-05' }))

    expect(isSnoozed(stale, NOW)).toBe(false)
    expect(isAvailable(stale, NOW)).toBe(true)
    expect(snoozeTask(stale, NOW).snoozedUntil).toBe('2026-10-06')
  })

  it('unsnoozeTask brings it back today (same reference when there is nothing to clear)', () => {
    const snoozed = snoozeTask(makeTask(), NOW)
    const plain = makeTask()

    expect(isAvailable(unsnoozeTask(snoozed), NOW)).toBe(true)
    expect(unsnoozeTask(snoozed).snoozedUntil).toBeNull()
    expect(unsnoozeTask(plain)).toBe(plain)
  })

  it('completing a snoozed task clears the snooze (one-off and recurring)', () => {
    const oneOff = snoozeTask(makeTask(), NOW)
    const recurring = snoozeTask(makeTask({ due: { date: '2026-10-05' }, recurrence: WEEKLY }), NOW)

    expect(completeTask(oneOff, NOW).snoozedUntil).toBeNull()
    expect(completeTask(recurring, NOW)).toMatchObject({ snoozedUntil: null, due: { date: '2026-10-12' } })
  })
})

describe('snooze and postponedDays', () => {
  it('counts like a postpone: once per day, also combined with "Later"', () => {
    const task = makeTask()

    const snoozed = snoozeTask(task, NOW)
    expect(snoozed.postponedDays).toBe(1)
    expect(snoozed.skippedAt).toBe(NOW.toISOString())

    const laterThenSnooze = snoozeTask(postponeTask(task, NOW), new Date(2026, 9, 5, 15, 0))
    expect(laterThenSnooze.postponedDays).toBe(1)

    // Back the next day: a new day counts again.
    const nextDay = new Date(2026, 9, 6, 9, 0)
    expect(postponeTask(snoozed, nextDay).postponedDays).toBe(2)
    expect(snoozeTask(snoozed, nextDay).postponedDays).toBe(2)
  })
})

describe('groups and counters', () => {
  const tasks = deepFreeze([
    snoozeTask(makeTask({ id: 'b', title: 'Banho no cachorro' }), NOW),
    snoozeTask(makeTask({ id: 'a', title: 'Academia' }), NOW),
    makeTask({ id: 'dormant', title: 'Regar', due: { date: '2026-10-08' }, recurrence: WEEKLY }),
    snoozeTask(makeTask({ id: 'rec', title: 'Varrer', due: { date: '2026-10-05' }, recurrence: WEEKLY }), NOW),
    makeTask({ id: 'today', title: 'Hoje' }),
    makeTask({ id: 'done', status: 'done', completedAt: localIso(2026, 9, 5, 8) }),
  ])

  it('lists snoozed tasks by title, then id, and never as dormant', () => {
    expect(snoozedTasks(tasks, NOW).map((task) => task.id)).toEqual(['a', 'b', 'rec'])
    expect(dormantTasks(tasks, NOW).map((task) => task.id)).toEqual(['dormant'])
    expect(availableTasks(tasks, NOW).map((task) => task.id)).toEqual(['today'])
  })

  it('dailyProgress counts snoozed tasks apart from what is left today', () => {
    expect(dailyProgress(tasks, NOW)).toEqual({ done: 1, remaining: 1, snoozed: 3 })
    expect(dailyProgress(tasks, new Date(2026, 9, 6, 9, 0))).toMatchObject({ snoozed: 0 })
  })

  it('a snoozed recurring task comes back the next day as overdue by 1 day, due date unchanged', () => {
    const back = tasks.find((task) => task.id === 'rec')
    const tomorrow = new Date(2026, 9, 6, 9, 0)

    expect(back?.due).toEqual({ date: '2026-10-05' })
    expect(back !== undefined && isAvailable(back, tomorrow)).toBe(true)
  })
})

describe('older data without snoozedUntil', () => {
  it('loads with no snooze (the field defaults to null, schemaVersion stays 1)', () => {
    const old: Record<string, unknown> = { ...makeTask({ id: 'old' }) }
    delete old.snoozedUntil

    expect(TaskSchema.parse(old).snoozedUntil).toBeNull()
  })

  it('loads a backup written before the field existed', () => {
    const task: Record<string, unknown> = { ...makeTask({ id: 'old', deckId: 'deck-1' }) }
    delete task.snoozedUntil
    const text = JSON.stringify({ app: 'taskdeck', schemaVersion: 1, exportedAt: NOW.toISOString(), decks: [{ id: 'deck-1', name: 'Casa' }], tasks: [task] })

    const result = parseBackup(text, context())

    expect(result.ok && result.data.tasks[0]?.snoozedUntil).toBeNull()
  })

  it('rejects a snoozedUntil that is not a calendar day', () => {
    expect(() => TaskSchema.parse({ ...makeTask(), snoozedUntil: '2026-02-30' })).toThrow()
  })
})
