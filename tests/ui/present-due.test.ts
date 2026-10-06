import { describe, expect, it } from 'vitest'
import type { Task } from '../../src/domain/index.ts'
import { en } from '../../src/i18n/en.ts'
import { ptBR } from '../../src/i18n/pt-BR.ts'
import { presentDue } from '../../src/ui/format.ts'
import { makeTask, NOW } from '../domain/fixtures.ts'

const WEEKLY = { unit: 'week', every: 1, anchor: 'due' } as const

function recurring(date: string, time?: string): Task {
  return makeTask({ due: time === undefined ? { date } : { date, time }, recurrence: WEEKLY })
}

describe('presentDue', () => {
  it.each<[string, Task, string, string, string]>([
    ['recurring, date only, today', recurring('2026-10-05'), 'Hoje', 'today', 'neutral'],
    ['recurring, date only, 1 day late', recurring('2026-10-04'), 'Pendente há 1 dia', 'pending', 'neutral'],
    ['recurring, date only, 3 days late', recurring('2026-10-02'), 'Pendente há 3 dias', 'pending', 'neutral'],
    // With a time, the deadline escalation stays as it was.
    ['recurring with a time, overdue', recurring('2026-10-05', '09:00'), 'Atrasada há 1 h', 'overdue', 'danger'],
    ['recurring with a time, soon', recurring('2026-10-05', '11:00'), 'Falta 1 h', 'soon', 'warning'],
    // One-off tasks are untouched.
    ['one-off, date only, overdue', makeTask({ due: { date: '2026-10-04' } }), 'Atrasada há 10 h', 'overdue', 'danger'],
    ['one-off, no due', makeTask(), 'Sem prazo', 'none', 'muted'],
  ])('%s', (_name, task, text, band, tone) => {
    const shown = presentDue(task, NOW, ptBR)

    expect(shown).toMatchObject({ text, band, tone })
    expect(shown.alert).toBe(band === 'overdue')
  })

  it('pluralizes in English', () => {
    expect(presentDue(recurring('2026-10-04'), NOW, en).text).toBe('Pending for 1 day')
    expect(presentDue(recurring('2026-10-01'), NOW, en).text).toBe('Pending for 4 days')
  })
})
