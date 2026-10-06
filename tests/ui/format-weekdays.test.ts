import { describe, expect, it } from 'vitest'
import type { Recurrence } from '../../src/domain/index.ts'
import { en } from '../../src/i18n/en.ts'
import { ptBR } from '../../src/i18n/pt-BR.ts'
import { formatRecurrence, formatRecurrenceShort, formatWeekdays, weekdayName } from '../../src/ui/format.ts'

const onDays = (weekdays: number[]): Recurrence => ({ unit: 'week', every: 1, anchor: 'due', weekdays })

describe('weekday names (Intl)', () => {
  it('names each day in both languages, 0 = Sunday', () => {
    expect(weekdayName(0, 'pt-BR', 'long')).toBe('domingo')
    expect(weekdayName(1, 'pt-BR', 'short')).toBe('seg.')
    expect(weekdayName(6, 'en', 'long')).toBe('Saturday')
    expect(weekdayName(3, 'en', 'short')).toBe('Wed')
  })
})

describe('formatWeekdays', () => {
  it.each<[number[], string, string]>([
    [[1, 2, 3, 4, 5], 'Dias úteis', 'Weekdays'],
    [[0, 6], 'Fins de semana', 'Weekends'],
    [[0, 1, 2, 3, 4, 5, 6], 'Todos os dias', 'Every day'],
    [[1, 3, 5], 'seg., qua. e sex.', 'Mon, Wed, and Fri'],
    [[2], 'ter.', 'Tue'],
  ])('%o -> "%s" / "%s"', (days, pt, english) => {
    expect(formatWeekdays(days, ptBR)).toBe(pt)
    expect(formatWeekdays(days, en)).toBe(english)
  })
})

describe('recurrence text with weekdays', () => {
  it('shows the days on the badge and the full rule on the back', () => {
    expect(formatRecurrenceShort(onDays([1, 3, 5]), ptBR)).toBe('seg., qua. e sex.')
    expect(formatRecurrence(onDays([1, 3, 5]), ptBR)).toBe('Toda semana: seg., qua. e sex., contando do prazo')
    expect(formatRecurrence(onDays([1, 2, 3, 4, 5]), en)).toBe('Every week: Weekdays, counted from the due date')
  })

  it('leaves recurrences without weekdays as they were', () => {
    expect(formatRecurrenceShort({ unit: 'week', every: 1, anchor: 'due' }, ptBR)).toBe('Toda semana')
  })
})
