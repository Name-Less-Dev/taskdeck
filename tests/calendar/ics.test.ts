import { describe, expect, it } from 'vitest'
import {
  buildIcs,
  escapeText,
  exportableCount,
  foldLine,
  icsFileName,
  recurrenceRule,
  type AlarmOption,
  type IcsOptions,
} from '../../src/calendar/ics.ts'
import type { Recurrence, Task } from '../../src/domain/index.ts'
import { localIso, makeTask, NOW } from '../domain/fixtures.ts'
import { LABELS } from './fixtures.ts'

function options(overrides: Partial<IcsOptions> = {}): IcsOptions {
  return { now: NOW, alarm: '15m', labels: LABELS, deckName: (id) => (id === 'deck-1' ? 'Casa' : undefined), ...overrides }
}

/** Unfolded content lines of one calendar. */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n /g, '').split('\r\n').filter((line) => line !== '')
}

function event(ics: string, uid: string): string[] {
  const lines = unfold(ics)
  const start = lines.indexOf(`UID:${uid}@taskdeck`) - 1
  return lines.slice(start, lines.indexOf('END:VEVENT', start) + 1)
}

const timed = makeTask({ id: 't1', title: 'Reunião', due: { date: '2026-10-07', time: '09:30' }, priority: 'high' })
const allDay = makeTask({ id: 't2', title: 'Aniversário', due: { date: '2026-12-31' }, priority: 'low' })

describe('escapeText', () => {
  it.each([
    ['backslash', 'C:\\pasta', 'C:\\\\pasta'],
    ['semicolon', 'a;b', 'a\\;b'],
    ['comma', 'pão, leite', 'pão\\, leite'],
    ['LF', 'linha 1\nlinha 2', 'linha 1\\nlinha 2'],
    ['CRLF', 'linha 1\r\nlinha 2', 'linha 1\\nlinha 2'],
    ['all together', 'a\\b;c,d\ne', 'a\\\\b\\;c\\,d\\ne'],
  ])('escapes %s', (_label, input, expected) => {
    expect(escapeText(input)).toBe(expected)
  })
})

describe('foldLine', () => {
  const octets = (text: string) => Buffer.byteLength(text, 'utf8')

  it.each([
    ['ASCII', `SUMMARY:${'a'.repeat(200)}`],
    ['accents (2 octets)', `SUMMARY:${'ação'.repeat(40)}`],
    ['CJK (3 octets)', `SUMMARY:${'漢字'.repeat(40)}`],
    ['emoji (4 octets, surrogate pairs)', `SUMMARY:${'🎉👍🏽'.repeat(30)}`],
    ['mixed', `DESCRIPTION:${'Lavar a roupa ✨ às 9h — não esquecer 🧺, ok? '.repeat(6)}`],
  ])('keeps every physical line within 75 octets without splitting a character: %s', (_label, line) => {
    const folded = foldLine(line)
    const physical = folded.split('\r\n')

    for (const [index, part] of physical.entries()) {
      expect(octets(part)).toBeLessThanOrEqual(75)
      if (index > 0) expect(part.startsWith(' ')).toBe(true)
      // A split inside a surrogate pair would not survive a UTF-8 round trip.
      expect(Buffer.from(part, 'utf8').toString('utf8')).toBe(part)
    }
    expect(folded.replace(/\r\n /g, '')).toBe(line)
  })

  it('leaves short lines alone', () => {
    expect(foldLine('VERSION:2.0')).toBe('VERSION:2.0')
  })

  it('uses the whole 75 octets on the first line', () => {
    expect(foldLine('x'.repeat(76)).split('\r\n').map((part) => part.length)).toEqual([75, 2])
  })
})

describe('buildIcs: calendar structure', () => {
  it('ends every line in CRLF and has the calendar header', () => {
    const ics = buildIcs([timed], options())

    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    expect(unfold(ics).slice(0, 4)).toEqual(['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//taskdeck//EN', 'CALSCALE:GREGORIAN'])
    expect(unfold(ics).at(-1)).toBe('END:VCALENDAR')
  })

  it('produces a calendar without events when nothing has a due date', () => {
    expect(unfold(buildIcs([makeTask()], options()))).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//taskdeck//EN',
      'CALSCALE:GREGORIAN',
      'END:VCALENDAR',
    ])
  })

  it('omits tasks without a due date and tasks already done', () => {
    const done = makeTask({ id: 'done', due: { date: '2026-10-07' }, status: 'done', completedAt: localIso(2026, 9, 5) })
    const ics = buildIcs([makeTask({ id: 'nodue' }), done, timed], options())

    expect(unfold(ics).filter((line) => line.startsWith('UID:'))).toEqual(['UID:t1@taskdeck'])
    expect(exportableCount([makeTask({ id: 'nodue' }), done, timed])).toBe(1)
  })

  it('orders events by task id, whatever the input order', () => {
    const uids = (tasks: Task[]) => unfold(buildIcs(tasks, options())).filter((line) => line.startsWith('UID:'))

    expect(uids([allDay, timed])).toEqual(['UID:t1@taskdeck', 'UID:t2@taskdeck'])
    expect(uids([timed, allDay])).toEqual(uids([allDay, timed]))
  })

  it('keeps the UID stable across exports and takes DTSTAMP from now, in UTC', () => {
    const first = buildIcs([timed], options())
    const later = new Date(2026, 9, 6, 18, 45, 30)
    const second = buildIcs([timed], options({ now: later }))

    expect(event(first, 't1')).toContain('UID:t1@taskdeck')
    expect(event(second, 't1')).toContain('UID:t1@taskdeck')
    const stamp = (date: Date) => `DTSTAMP:${date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`
    expect(event(first, 't1')).toContain(stamp(NOW))
    expect(event(second, 't1')).toContain(stamp(later))
    expect(stamp(later)).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/)
  })
})

describe('buildIcs: event fields', () => {
  it('exports a timed due as floating local time lasting 15 minutes', () => {
    const lines = event(buildIcs([timed], options()), 't1')

    expect(lines).toContain('DTSTART:20261007T093000')
    expect(lines).toContain('DURATION:PT15M')
    expect(lines.some((line) => line.startsWith('DTEND'))).toBe(false)
    expect(lines.some((line) => line.includes('TZID') || /DTSTART:.*Z$/.test(line))).toBe(false)
  })

  it('exports a date-only due as an all-day event ending the next day', () => {
    const lines = event(buildIcs([allDay], options()), 't2')

    expect(lines).toContain('DTSTART;VALUE=DATE:20261231')
    expect(lines).toContain('DTEND;VALUE=DATE:20270101')
    expect(lines.some((line) => line.startsWith('DURATION'))).toBe(false)
  })

  it('maps title, description with priority and deck, tags and priority', () => {
    const task = makeTask({
      id: 'x',
      deckId: 'deck-1',
      title: 'Pão, leite; ovos',
      description: 'Na padaria\nda esquina',
      tags: ['mercado', 'casa'],
      priority: 'high',
      due: { date: '2026-10-08' },
    })
    const lines = event(buildIcs([task], options()), 'x')

    expect(lines).toContain('SUMMARY:Pão\\, leite\\; ovos')
    expect(lines).toContain('DESCRIPTION:Na padaria\\nda esquina\\n\\nPrioridade: Alta\\nBaralho: Casa')
    expect(lines).toContain('CATEGORIES:mercado,casa')
    expect(lines).toContain('PRIORITY:1')
  })

  it.each([
    ['high', 1],
    ['medium', 5],
    ['low', 9],
  ] as const)('maps %s priority to PRIORITY:%i', (priority, value) => {
    expect(event(buildIcs([makeTask({ id: 'p', priority, due: { date: '2026-10-08' } })], options()), 'p')).toContain(
      `PRIORITY:${value}`,
    )
  })

  it('leaves out the deck when it is unknown and the description when empty', () => {
    const lines = event(buildIcs([makeTask({ id: 'u', deckId: 'other', due: { date: '2026-10-08' } })], options()), 'u')

    expect(lines).toContain('DESCRIPTION:Prioridade: Média')
    expect(lines.some((line) => line.startsWith('CATEGORIES'))).toBe(false)
  })
})

describe('buildIcs: alarms', () => {
  it.each<[AlarmOption, string | null, string | null]>([
    ['none', null, null],
    ['at-time', 'PT0S', 'PT9H'],
    ['15m', '-PT15M', 'PT9H'],
    ['1h', '-PT1H', 'PT9H'],
    ['1d', '-P1D', '-PT15H'],
  ])('alarm %s: timed trigger %s, all-day trigger %s (09:00)', (alarm, timedTrigger, allDayTrigger) => {
    const ics = buildIcs([timed, allDay], options({ alarm }))
    const trigger = (uid: string) => event(ics, uid).find((line) => line.startsWith('TRIGGER:')) ?? null

    expect(trigger('t1')).toBe(timedTrigger === null ? null : `TRIGGER:${timedTrigger}`)
    expect(trigger('t2')).toBe(allDayTrigger === null ? null : `TRIGGER:${allDayTrigger}`)
  })

  it('writes a DISPLAY alarm with the task title as its description', () => {
    const lines = event(buildIcs([timed], options()), 't1')
    const start = lines.indexOf('BEGIN:VALARM')

    expect(lines.slice(start, start + 5)).toEqual(['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Reunião', 'TRIGGER:-PT15M', 'END:VALARM'])
  })
})

describe('buildIcs: recurrence', () => {
  const due = { date: '2026-10-07' }

  it.each<[string, Recurrence, string | null]>([
    ['daily', { unit: 'day', every: 1, anchor: 'due' }, 'FREQ=DAILY;INTERVAL=1'],
    ['every 3 days', { unit: 'day', every: 3, anchor: 'due' }, 'FREQ=DAILY;INTERVAL=3'],
    ['weekly', { unit: 'week', every: 1, anchor: 'due' }, 'FREQ=WEEKLY;INTERVAL=1'],
    ['every 2 weeks', { unit: 'week', every: 2, anchor: 'due' }, 'FREQ=WEEKLY;INTERVAL=2'],
    ['monthly on the 7th', { unit: 'month', every: 1, anchor: 'due', originDay: 7 }, 'FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=7'],
    ['monthly on the 28th', { unit: 'month', every: 1, anchor: 'due', originDay: 28 }, 'FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=28'],
    ['monthly on the 29th: no portable rule', { unit: 'month', every: 1, anchor: 'due', originDay: 29 }, null],
    ['monthly on the 30th: no portable rule', { unit: 'month', every: 1, anchor: 'due', originDay: 30 }, null],
    ['monthly on the 31st: last day of the month', { unit: 'month', every: 1, anchor: 'due', originDay: 31 }, 'FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1'],
    [
      'monthly on the 31st, every 2 months',
      { unit: 'month', every: 2, anchor: 'due', originDay: 31 },
      'FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=-1',
    ],
    ['anchored on completion: no rule', { unit: 'week', every: 1, anchor: 'completion' }, null],
    ['Mon, Wed and Fri', { unit: 'week', every: 1, anchor: 'due', weekdays: [1, 3, 5] }, 'FREQ=WEEKLY;BYDAY=MO,WE,FR'],
    ['weekdays', { unit: 'week', every: 1, anchor: 'due', weekdays: [1, 2, 3, 4, 5] }, 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'],
    ['weekends', { unit: 'week', every: 1, anchor: 'due', weekdays: [0, 6] }, 'FREQ=WEEKLY;BYDAY=SU,SA'],
  ])('%s', (_label, recurrence, expected) => {
    expect(recurrenceRule(recurrence, due)).toBe(expected)
  })

  it('writes the RRULE into the event', () => {
    const task = makeTask({ id: 'r', due: { date: '2026-10-07', time: '08:00' }, recurrence: { unit: 'week', every: 2, anchor: 'due' } })

    expect(event(buildIcs([task], options()), 'r')).toContain('RRULE:FREQ=WEEKLY;INTERVAL=2')
  })

  it('exports only the next occurrence of a monthly task on the 30th and says so', () => {
    const task = makeTask({ id: 'm30', due: { date: '2026-11-30' }, recurrence: { unit: 'month', every: 1, anchor: 'due', originDay: 30 } })
    const lines = event(buildIcs([task], options()), 'm30')

    expect(lines.some((line) => line.startsWith('RRULE'))).toBe(false)
    expect(lines.find((line) => line.startsWith('DESCRIPTION:'))).toContain('Repete todo mês no dia 30 (ou no último dia)')
  })

  it('exports only the next occurrence of a completion-anchored task and says so', () => {
    const task = makeTask({ id: 'c', due: { date: '2026-10-07' }, recurrence: { unit: 'day', every: 3, anchor: 'completion' } })
    const lines = event(buildIcs([task], options()), 'c')

    expect(lines.some((line) => line.startsWith('RRULE'))).toBe(false)
    expect(lines.find((line) => line.startsWith('DESCRIPTION:'))).toContain(
      'Repete a partir da conclusão: só a próxima data foi exportada.',
    )
  })
})

describe('icsFileName', () => {
  it('uses the given local day', () => {
    expect(icsFileName('2026-10-05')).toBe('taskdeck-2026-10-05.ics')
  })
})
