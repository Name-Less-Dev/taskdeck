import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { collectTags, filterByTag, updateTask, type Task, type TaskPatch } from '../../src/domain/index.ts'
import { deepFreeze, localIso, makeTask } from './fixtures.ts'

const tasks = deepFreeze([
  makeTask({ id: 'a', tags: ['casa', 'urgente'] }),
  makeTask({ id: 'b', tags: ['trabalho', 'urgente'] }),
  makeTask({ id: 'c', tags: ['casa'] }),
  makeTask({ id: 'd', tags: ['zebra'] }),
  makeTask({ id: 'e', tags: [] }),
])

describe('collectTags', () => {
  it('counts tags, most used first, then alphabetical', () => {
    expect(collectTags(tasks)).toEqual([
      { tag: 'casa', count: 2 },
      { tag: 'urgente', count: 2 },
      { tag: 'trabalho', count: 1 },
      { tag: 'zebra', count: 1 },
    ])
  })

  it('returns an empty list when no task has tags', () => {
    expect(collectTags([makeTask()])).toEqual([])
  })
})

describe('filterByTag', () => {
  it.each<[string, string | null, string[]]>([
    ['no filter (null) keeps every task', null, ['a', 'b', 'c', 'd', 'e']],
    ['an existing tag', 'casa', ['a', 'c']],
    ['a tag written with other case and spaces', '  URGENTE ', ['a', 'b']],
    ['a tag nobody uses', 'inexistente', []],
  ])('filters by %s', (_label, tag, expected) => {
    expect(filterByTag(tasks, tag).map((task) => task.id)).toEqual(expected)
  })

  it('returns a new array even without a filter', () => {
    expect(filterByTag(tasks, null)).not.toBe(tasks)
  })
})

describe('updateTask', () => {
  const original: Task = deepFreeze(
    makeTask({
      id: 'r1',
      title: 'Lavar a roupa',
      tags: ['casa'],
      due: { date: '2026-10-03', time: '09:00' },
      recurrence: { unit: 'week', every: 1, anchor: 'due' },
      status: 'active',
      completedAt: localIso(2026, 8, 26, 9, 0),
      skippedAt: localIso(2026, 9, 4, 8, 0),
      postponedDays: 2,
    }),
  )

  it('applies the editable fields and normalizes tags', () => {
    const updated = updateTask(original, {
      title: '  Lavar e passar  ',
      description: 'Brancas',
      tags: [' Casa ', 'ROUPA', 'roupa'],
      priority: 'high',
      due: { date: '2026-10-04' },
      deckId: 'deck-2',
    })

    expect(updated).toMatchObject({
      title: 'Lavar e passar',
      description: 'Brancas',
      tags: ['casa', 'roupa'],
      priority: 'high',
      due: { date: '2026-10-04' },
      deckId: 'deck-2',
    })
  })

  it('keeps the recurrence and every counter when editing a recurring task', () => {
    const updated = updateTask(original, { title: 'Outro título' })

    expect(updated).toEqual({ ...original, title: 'Outro título' })
    expect(updated.recurrence).toEqual({ unit: 'week', every: 1, anchor: 'due' })
  })

  it('ignores fields that are not editable even if the object carries them', () => {
    const sneaky = { title: 'Novo', status: 'done', id: 'other', postponedDays: 99 } as TaskPatch

    const updated = updateTask(original, sneaky)

    expect(updated).toMatchObject({ id: 'r1', status: 'active', postponedDays: 2, title: 'Novo' })
  })

  it('refuses to remove the due date of a recurring task', () => {
    expect(() => updateTask(original, { due: null })).toThrow(ZodError)
  })

  it('allows removing the due date of a one-off task', () => {
    expect(updateTask(makeTask({ due: { date: '2026-10-05' } }), { due: null }).due).toBeNull()
  })

  it.each<[string, TaskPatch]>([
    ['an empty title', { title: '  ' }],
    ['a title over 80 characters', { title: 'x'.repeat(81) }],
    ['11 tags', { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }],
    ['an invalid date', { due: { date: '2026-02-30' } }],
    ['an empty deck id', { deckId: '' }],
  ])('rejects a patch with %s', (_label, patch) => {
    expect(() => updateTask(original, patch)).toThrow(ZodError)
  })

  it('moves originDay with a new due date on monthly "due" recurrences', () => {
    const monthly = makeTask({
      due: { date: '2026-01-31' },
      recurrence: { unit: 'month', every: 1, anchor: 'due', originDay: 31 },
    })

    expect(updateTask(monthly, { due: { date: '2026-02-15' } }).recurrence).toEqual({
      unit: 'month',
      every: 1,
      anchor: 'due',
      originDay: 15,
    })
    expect(updateTask(monthly, { title: 'x' }).recurrence?.originDay).toBe(31)
  })

  it('does not mutate the task', () => {
    updateTask(original, { title: 'Mudou' })

    expect(original.title).toBe('Lavar a roupa')
  })
})
