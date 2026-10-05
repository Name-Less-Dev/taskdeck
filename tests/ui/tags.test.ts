import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { createTask, MAX_TAGS, updateTask } from '../../src/domain/index.ts'
import { ptBR } from '../../src/i18n/pt-BR.ts'
import { taskFormErrors } from '../../src/ui/form-errors.ts'
import { addTags } from '../../src/ui/tags.ts'
import { makeTask, NOW } from '../domain/fixtures.ts'

describe('addTags', () => {
  it.each<[string, string[], string, string[]]>([
    ['normalizes case and spaces', [], '  Casa ', ['casa']],
    ['splits on commas', [], 'casa, Trabalho,urgente', ['casa', 'trabalho', 'urgente']],
    ['skips duplicates silently', ['casa'], 'CASA, casa', ['casa']],
    ['ignores empty pieces', ['casa'], ' , ,', ['casa']],
  ])('%s', (_label, current, text, expected) => {
    expect(addTags(current, text)).toEqual({ tags: expected, error: null })
  })

  it('reports a tag that is too long and keeps the valid ones', () => {
    expect(addTags([], `ok, ${'x'.repeat(21)}`)).toEqual({ tags: ['ok'], error: 'too-long' })
  })

  it('stops at the tag limit', () => {
    const full = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`)

    expect(addTags(full, 'extra')).toEqual({ tags: full, error: 'too-many' })
    expect(addTags(full, 't0')).toEqual({ tags: full, error: null })
  })

  it('does not mutate the current list', () => {
    const current = Object.freeze(['casa'])

    addTags(current, 'novo')

    expect(current).toEqual(['casa'])
  })
})

describe('taskFormErrors for tags and recurrence', () => {
  function errorOf(run: () => unknown): ZodError {
    try {
      run()
    } catch (error) {
      if (error instanceof ZodError) return error
    }
    throw new Error('expected a ZodError')
  }

  it('maps too many tags and a too long tag', () => {
    const tooMany = errorOf(() =>
      createTask({ deckId: 'd', title: 'x', tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }, { id: 'a', now: NOW }),
    )
    const tooLong = errorOf(() => createTask({ deckId: 'd', title: 'x', tags: ['x'.repeat(21)] }, { id: 'a', now: NOW }))

    expect(taskFormErrors(tooMany, ptBR)).toEqual({ tags: 'Use no máximo 10 tags.' })
    expect(taskFormErrors(tooLong, ptBR)).toEqual({ tags: 'Cada tag pode ter no máximo 20 caracteres.' })
  })

  it('maps removing the due date of a recurring task to the date field', () => {
    const recurring = makeTask({ due: { date: '2026-10-05' }, recurrence: { unit: 'week', every: 1, anchor: 'due' } })

    expect(taskFormErrors(errorOf(() => updateTask(recurring, { due: null })), ptBR)).toEqual({
      date: 'Uma tarefa recorrente precisa de uma data.',
    })
  })
})
