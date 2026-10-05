import { describe, expect, it } from 'vitest'
import { compareUrgency, orderDeck, topCard, URGENCY_BANDS, type Task } from '../../src/domain/index.ts'
import { deepFreeze, localIso, makeTask, NOW } from './fixtures.ts'

/** Deterministic Fisher-Yates shuffle driven by a seeded LCG (no Math.random). */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const result = [...items]
  let state = seed
  for (let i = result.length - 1; i > 0; i--) {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31
    const j = state % (i + 1)
    const a = result[i]
    const b = result[j]
    if (a === undefined || b === undefined) throw new Error('index out of range')
    result[i] = b
    result[j] = a
  }
  return result
}

function ids(tasks: readonly Task[]): string[] {
  return tasks.map((task) => task.id)
}

describe('compareUrgency', () => {
  it('lists the bands from most to least urgent', () => {
    expect(URGENCY_BANDS).toEqual(['overdue', 'soon', 'today', 'tomorrow', 'week', 'later', 'none'])
  })

  it.each<[string, Partial<Task>, Partial<Task>]>([
    ['overdue before soon', { due: { date: '2026-10-04' } }, { due: { date: '2026-10-05', time: '11:00' } }],
    ['soon before today', { due: { date: '2026-10-05', time: '11:00' } }, { due: { date: '2026-10-05' } }],
    ['today before tomorrow', { due: { date: '2026-10-05' } }, { due: { date: '2026-10-06' } }],
    ['tomorrow before week', { due: { date: '2026-10-06' } }, { due: { date: '2026-10-08' } }],
    ['week before later', { due: { date: '2026-10-12' } }, { due: { date: '2026-10-13' } }],
    ['later before none', { due: { date: '2027-01-01' } }, { due: null }],
    [
      'a more urgent band wins over a higher priority',
      { due: { date: '2026-10-05' }, priority: 'low' },
      { due: { date: '2026-10-06' }, priority: 'high' },
    ],
    [
      'high before medium within a band',
      { due: { date: '2026-10-08' }, priority: 'high' },
      { due: { date: '2026-10-07' }, priority: 'medium' },
    ],
    ['medium before low within a band', { priority: 'medium' }, { priority: 'low' }],
    [
      'earlier due first with the same band and priority',
      { due: { date: '2026-10-07' } },
      { due: { date: '2026-10-09' } },
    ],
    [
      'timed due before date-only due on the same day',
      { due: { date: '2026-10-06', time: '18:00' } },
      { due: { date: '2026-10-06' } },
    ],
    ['older createdAt first when the rest ties', { createdAt: localIso(2026, 8, 1) }, { createdAt: localIso(2026, 8, 2) }],
    ['smaller id last tie-breaker', { id: 'a' }, { id: 'b' }],
  ])('orders %s', (_label, first, second) => {
    const a = makeTask({ id: 'x', ...first })
    const b = makeTask({ id: 'x', ...second })

    expect(compareUrgency(a, b, NOW)).toBeLessThan(0)
    expect(compareUrgency(b, a, NOW)).toBeGreaterThan(0)
  })

  it('returns 0 only for tasks equal in every sorting key', () => {
    expect(compareUrgency(makeTask(), makeTask(), NOW)).toBe(0)
  })
})

describe('orderDeck', () => {
  const deck = [
    makeTask({ id: 'none-low', priority: 'low' }),
    makeTask({ id: 'none-high', priority: 'high' }),
    makeTask({ id: 'later', due: { date: '2026-11-01' } }),
    makeTask({ id: 'week-b', due: { date: '2026-10-09' } }),
    makeTask({ id: 'week-a', due: { date: '2026-10-08' } }),
    makeTask({ id: 'tomorrow', due: { date: '2026-10-06' } }),
    makeTask({ id: 'today-low', due: { date: '2026-10-05' }, priority: 'low' }),
    makeTask({ id: 'today-high', due: { date: '2026-10-05' }, priority: 'high' }),
    makeTask({ id: 'soon', due: { date: '2026-10-05', time: '11:30' } }),
    makeTask({ id: 'overdue-new', due: { date: '2026-10-03' }, createdAt: localIso(2026, 8, 20) }),
    makeTask({ id: 'overdue-old', due: { date: '2026-10-03' }, createdAt: localIso(2026, 8, 10) }),
    makeTask({ id: 'overdue-b', due: { date: '2026-10-03' }, createdAt: localIso(2026, 8, 10) }),
  ]
  const expected = [
    'overdue-b',
    'overdue-old',
    'overdue-new',
    'soon',
    'today-high',
    'today-low',
    'tomorrow',
    'week-a',
    'week-b',
    'later',
    'none-high',
    'none-low',
  ]

  it('orders by band, priority, due, createdAt and id', () => {
    expect(ids(orderDeck(deck, NOW))).toEqual(expected)
  })

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('returns the same order for shuffled input (seed %i)', (seed) => {
    expect(ids(orderDeck(shuffled(deck, seed), NOW))).toEqual(expected)
  })

  it('moves a task postponed today after every task not postponed today', () => {
    const tasks = [
      makeTask({ id: 'urgent', due: { date: '2026-10-01' }, skippedAt: localIso(2026, 9, 5, 9, 0) }),
      makeTask({ id: 'no-due', priority: 'low' }),
    ]

    expect(ids(orderDeck(tasks, NOW))).toEqual(['no-due', 'urgent'])
  })

  it('orders tasks postponed today by skippedAt, then id', () => {
    const tasks = [
      makeTask({ id: 'c', skippedAt: localIso(2026, 9, 5, 9, 30) }),
      makeTask({ id: 'b', skippedAt: localIso(2026, 9, 5, 8, 0) }),
      makeTask({ id: 'a', skippedAt: localIso(2026, 9, 5, 9, 30) }),
      makeTask({ id: 'fresh' }),
    ]

    expect(ids(orderDeck(tasks, NOW))).toEqual(['fresh', 'b', 'a', 'c'])
  })

  it('puts a task postponed yesterday back in urgency order', () => {
    const tasks = [
      makeTask({ id: 'no-due' }),
      makeTask({ id: 'overdue', due: { date: '2026-10-01' }, skippedAt: localIso(2026, 9, 4, 23, 59) }),
    ]

    expect(ids(orderDeck(tasks, NOW))).toEqual(['overdue', 'no-due'])
  })

  it('leaves done tasks out', () => {
    const tasks = [
      makeTask({ id: 'done', status: 'done', completedAt: localIso(2026, 9, 4) }),
      makeTask({ id: 'active' }),
    ]

    expect(ids(orderDeck(tasks, NOW))).toEqual(['active'])
  })

  it('does not mutate the input and returns a new array', () => {
    const tasks = deepFreeze(shuffled(deck, 42))
    const before = ids(tasks)

    const ordered = orderDeck(tasks, NOW)

    expect(ordered).not.toBe(tasks)
    expect(ids(tasks)).toEqual(before)
  })
})

describe('topCard', () => {
  it('returns the first card of the ordered deck', () => {
    const tasks = [makeTask({ id: 'later', due: { date: '2026-12-01' } }), makeTask({ id: 'today', due: { date: '2026-10-05' } })]

    expect(topCard(tasks, NOW)?.id).toBe('today')
  })

  it('returns null when nothing is active', () => {
    expect(topCard([], NOW)).toBeNull()
    expect(topCard([makeTask({ status: 'done', completedAt: localIso(2026, 9, 4) })], NOW)).toBeNull()
  })
})
