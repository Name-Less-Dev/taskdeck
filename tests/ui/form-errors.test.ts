import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { createTask, type TaskInput } from '../../src/domain/index.ts'
import { en } from '../../src/i18n/en.ts'
import { ptBR } from '../../src/i18n/pt-BR.ts'
import { taskFormErrors } from '../../src/ui/form-errors.ts'
import { NOW } from '../domain/fixtures.ts'

function zodErrorFor(input: Partial<TaskInput>): ZodError {
  try {
    createTask({ deckId: 'd', title: 'Ok', ...input }, { id: 'x', now: NOW })
  } catch (error) {
    if (error instanceof ZodError) return error
    throw error
  }
  throw new Error('expected createTask to fail')
}

describe('taskFormErrors', () => {
  it('maps an empty title to "required"', () => {
    expect(taskFormErrors(zodErrorFor({ title: '  ' }), ptBR)).toEqual({ title: 'Informe um título.' })
  })

  it('maps a long title and a long description to their limits', () => {
    const errors = taskFormErrors(zodErrorFor({ title: 'x'.repeat(81), description: 'y'.repeat(1001) }), en)

    expect(errors).toEqual({
      title: 'Use at most 80 characters.',
      description: 'Use at most 1000 characters.',
    })
  })

  it('maps invalid due dates and times to their fields', () => {
    const errors = taskFormErrors(zodErrorFor({ due: { date: '2026-02-30', time: '25:00' } }), ptBR)

    expect(errors).toEqual({ date: 'Informe uma data válida.', time: 'Informe uma hora válida (HH:mm).' })
  })

  it('puts issues without a form field under "form"', () => {
    const errors = taskFormErrors(zodErrorFor({ deckId: '' }), en)

    expect(errors).toEqual({ form: 'Invalid value.' })
  })

  it('keeps only the first message per field', () => {
    const error = new ZodError([
      { code: 'custom', path: ['title'], message: 'a', input: '' },
      { code: 'too_big', path: ['title'], message: 'b', maximum: 80, origin: 'string', inclusive: true, input: '' },
    ])

    expect(taskFormErrors(error, ptBR)).toEqual({ title: 'Informe um título.' })
  })
})
