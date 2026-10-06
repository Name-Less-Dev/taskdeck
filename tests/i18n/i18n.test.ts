import { describe, expect, it } from 'vitest'
import type { DueStatus } from '../../src/domain/index.ts'
import type { Dictionary } from '../../src/i18n/dictionary.ts'
import { en } from '../../src/i18n/en.ts'
import { detectLocale } from '../../src/i18n/locale.ts'
import { ptBR } from '../../src/i18n/pt-BR.ts'
import { dueTone, formatDueDate, formatDueStatus, formatRecurrence, formatRecurrenceShort } from '../../src/ui/format.ts'

/** Sorted dotted paths of every leaf in a dictionary, e.g. "due.inDays". */
function keyPaths(value: object, prefix = ''): string[] {
  return Object.entries(value)
    .flatMap(([key, child]) =>
      typeof child === 'object' && child !== null ? keyPaths(child as object, `${prefix}${key}.`) : [`${prefix}${key}`],
    )
    .sort()
}

describe('dictionaries', () => {
  it('have exactly the same keys in pt-BR and en', () => {
    expect(keyPaths(ptBR)).toEqual(keyPaths(en))
  })

  it('have the same kind of value (text or function) for every key', () => {
    const kinds = (dict: Dictionary) =>
      keyPaths(dict).map((path) => {
        const leaf = path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], dict)
        return `${path}:${typeof leaf}`
      })

    expect(kinds(ptBR)).toEqual(kinds(en))
  })

  it('declare their own locale', () => {
    expect([ptBR.locale, en.locale]).toEqual(['pt-BR', 'en'])
  })
})

describe('detectLocale', () => {
  it.each([
    ['', 'pt-BR', 'pt-BR'],
    ['', 'pt-PT', 'pt-BR'],
    ['', 'PT', 'pt-BR'],
    ['', 'en-US', 'en'],
    ['', 'es-ES', 'en'],
    ['?lang=en', 'pt-BR', 'en'],
    ['?lang=pt-BR', 'en-US', 'pt-BR'],
    ['?foo=1&lang=en', 'pt-BR', 'en'],
    ['?lang=fr', 'pt-BR', 'pt-BR'],
    ['?lang=fr', 'de', 'en'],
  ])('search "%s" with browser language %s gives %s', (search, language, expected) => {
    expect(detectLocale({ search, language })).toBe(expected)
  })
})

describe('formatDueStatus', () => {
  it.each<[DueStatus, string, string]>([
    [{ kind: 'none' }, 'Sem prazo', 'No due date'],
    [{ kind: 'overdue', overdueMinutes: 0 }, 'Atrasada agora', 'Overdue now'],
    [{ kind: 'overdue', overdueMinutes: 1 }, 'Atrasada há 1 min', 'Overdue by 1 min'],
    [{ kind: 'overdue', overdueMinutes: 59 }, 'Atrasada há 59 min', 'Overdue by 59 min'],
    [{ kind: 'overdue', overdueMinutes: 60 }, 'Atrasada há 1 h', 'Overdue by 1 h'],
    [{ kind: 'overdue', overdueMinutes: 150 }, 'Atrasada há 2 h', 'Overdue by 2 h'],
    [{ kind: 'overdue', overdueMinutes: 1439 }, 'Atrasada há 23 h', 'Overdue by 23 h'],
    [{ kind: 'overdue', overdueMinutes: 1440 }, 'Atrasada há 1 dia', 'Overdue by 1 day'],
    [{ kind: 'overdue', overdueMinutes: 3 * 1440 + 5 }, 'Atrasada há 3 dias', 'Overdue by 3 days'],
    [{ kind: 'soon', inMinutes: 1 }, 'Falta 1 min', 'In 1 min'],
    [{ kind: 'soon', inMinutes: 45 }, 'Faltam 45 min', 'In 45 min'],
    [{ kind: 'soon', inMinutes: 60 }, 'Falta 1 h', 'In 1 h'],
    [{ kind: 'soon', inMinutes: 90 }, 'Falta 1 h 30 min', 'In 1 h 30 min'],
    [{ kind: 'soon', inMinutes: 120 }, 'Faltam 2 h', 'In 2 h'],
    [{ kind: 'soon', inMinutes: 179 }, 'Faltam 2 h 59 min', 'In 2 h 59 min'],
    [{ kind: 'today' }, 'Hoje', 'Today'],
    [{ kind: 'tomorrow' }, 'Amanhã', 'Tomorrow'],
    [{ kind: 'week', inDays: 3 }, 'Em 3 dias', 'In 3 days'],
    [{ kind: 'later', inDays: 12 }, 'Em 12 dias', 'In 12 days'],
  ])('formats %o as "%s" / "%s"', (status, pt, english) => {
    expect(formatDueStatus(status, ptBR)).toBe(pt)
    expect(formatDueStatus(status, en)).toBe(english)
  })
})

describe('other formatters', () => {
  it('formats recurrences with plurals and the completion anchor', () => {
    expect(formatRecurrence({ unit: 'week', every: 1, anchor: 'due' }, ptBR)).toBe('Toda semana, contando do prazo')
    expect(formatRecurrenceShort({ unit: 'week', every: 1, anchor: 'due' }, ptBR)).toBe('Toda semana')
    expect(formatRecurrenceShort({ unit: 'week', every: 2, anchor: 'completion' }, en)).toBe('Every 2 weeks')
    expect(formatRecurrence({ unit: 'week', every: 2, anchor: 'due' }, en)).toBe('Every 2 weeks, counted from the due date')
    expect(formatRecurrence({ unit: 'day', every: 1, anchor: 'completion' }, ptBR)).toBe(
      'Todo dia, contando da conclusão',
    )
    expect(formatRecurrence({ unit: 'day', every: 3, anchor: 'due' }, ptBR)).toBe('A cada 3 dias, contando do prazo')
    expect(formatRecurrence({ unit: 'month', every: 1, anchor: 'due', originDay: 5 }, en)).toBe('Every month, counted from the due date')
    expect(formatRecurrence({ unit: 'month', every: 6, anchor: 'completion' }, ptBR)).toBe(
      'A cada 6 meses, contando da conclusão',
    )
    expect(formatRecurrence({ unit: 'day', every: 2, anchor: 'due' }, en)).toBe('Every 2 days, counted from the due date')
    expect(formatRecurrence({ unit: 'week', every: 1, anchor: 'completion' }, en)).toBe(
      'Every week, counted from completion',
    )
  })

  it('uses the plural for zero in Portuguese, despite the CLDR "one" category', () => {
    expect(new Intl.PluralRules('pt-BR').select(0)).toBe('one')
    expect(ptBR.readOnly.found(0, 0)).toBe('Encontrado: 0 registros de baralho, 0 registros de tarefa.')
    expect(en.readOnly.found(0, 1)).toBe('Found: 0 deck records, 1 task record.')
  })

  it('formats the postponed badge and counter with plurals', () => {
    expect([ptBR.card.postponedBadge(1), ptBR.card.postponedBadge(3)]).toEqual(['adiada 1 dia', 'adiada 3 dias'])
    expect([en.card.postponedBadge(1), en.card.postponedBadge(3)]).toEqual(['postponed 1 day', 'postponed 3 days'])
    expect([ptBR.card.postponedCount(0), en.card.postponedCount(2)]).toEqual(['Nunca', '2 days'])
  })

  it('formats the due date per locale, with the time only when there is one', () => {
    // ICU output varies slightly across Node versions, so check the parts that matter.
    const pt = formatDueDate({ date: '2026-10-05', time: '18:30' }, 'pt-BR', ptBR)
    const english = formatDueDate({ date: '2026-10-05', time: '18:30' }, 'en', en)
    const dateOnly = formatDueDate({ date: '2026-10-05' }, 'en', en)

    expect(pt).toMatch(/5 de out/)
    expect(pt).toMatch(/18:30/)
    expect(english).toMatch(/Oct 5/)
    expect(english).toMatch(/06:30\s?PM/)
    expect(dateOnly).not.toMatch(/\d:\d/)
    expect(formatDueDate(null, 'en', en)).toBe('No due date')
  })

  it('maps every band to a tone', () => {
    expect(
      (['overdue', 'soon', 'today', 'tomorrow', 'week', 'later', 'none'] as const).map((kind) => dueTone(kind)),
    ).toEqual(['danger', 'warning', 'accent', 'accent', 'neutral', 'neutral', 'muted'])
  })
})
