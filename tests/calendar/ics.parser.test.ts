import ICAL from 'ical.js'
import { describe, expect, it } from 'vitest'
import { buildIcs } from '../../src/calendar/ics.ts'
import { createTask, isRecurring, nextDue, type Task, type TaskInput } from '../../src/domain/index.ts'
import { NOW } from '../domain/fixtures.ts'
import { LABELS } from './fixtures.ts'

/**
 * Validation with an independent, maintained parser (ical.js, by the
 * Thunderbird calendar maintainer): it reads our output and the fields must
 * match what we meant to write. Recurrences are expanded by ical.js and
 * compared with the domain's own nextDue.
 */

function task(id: string, input: Omit<TaskInput, 'deckId'>): Task {
  return createTask({ deckId: 'deck-1', ...input }, { id, now: NOW })
}

const sample: Task[] = [
  task('a-weekly', {
    title: 'Reunião semanal, sala 3; levar café ☕',
    description: 'Pauta:\n- números\n- próximos passos, com \\ barra',
    tags: ['trabalho', 'reunião'],
    priority: 'high',
    due: { date: '2026-10-07', time: '09:30' },
    recurrence: { unit: 'week', every: 1, anchor: 'due' },
  }),
  task('b-month31', {
    title: 'Pagar aluguel',
    priority: 'medium',
    due: { date: '2026-01-31' },
    recurrence: { unit: 'month', every: 1, anchor: 'due' },
  }),
  task('c-daily3', {
    title: 'Regar as plantas 🌱 '.repeat(4).trim(),
    priority: 'low',
    due: { date: '2026-10-05', time: '07:00' },
    recurrence: { unit: 'day', every: 3, anchor: 'due' },
  }),
  task('d-completion', {
    title: 'Cortar o cabelo',
    due: { date: '2026-10-20' },
    recurrence: { unit: 'week', every: 4, anchor: 'completion' },
  }),
  task('e-month29', {
    title: 'Revisão mensal',
    due: { date: '2026-01-29', time: '18:00' },
    recurrence: { unit: 'month', every: 1, anchor: 'due' },
  }),
]

function parse(ics: string) {
  const calendar = ICAL.Component.fromString(ics)
  return new Map(
    calendar
      .getAllSubcomponents('vevent')
      .map((vevent) => [String(vevent.getFirstPropertyValue('uid')), vevent] as const),
  )
}

const ics = buildIcs(sample, {
  now: NOW,
  alarm: '15m',
  labels: LABELS,
  deckName: () => 'Casa',
})
const events = parse(ics)

function get(uid: string) {
  const vevent = events.get(`${uid}@taskdeck`)
  if (vevent === undefined) throw new Error(`missing event ${uid}`)
  return { vevent, event: new ICAL.Event(vevent) }
}

/** The first `count` start dates ical.js expands for an event, as "YYYY-MM-DD". */
function expand(uid: string, count: number): string[] {
  const iterator = get(uid).event.iterator()
  const dates: string[] = []
  for (let next = iterator.next(); dates.length < count; next = iterator.next()) {
    dates.push(next.toString().slice(0, 10))
  }
  return dates
}

/** The same sequence according to the domain: complete the task on each due day. */
function domainSequence(source: Task, count: number): string[] {
  if (!isRecurring(source)) throw new Error('not recurring')
  const dates = [source.due.date]
  let current = source
  while (dates.length < count) {
    const [y, m, d] = current.due.date.split('-').map(Number) as [number, number, number]
    const due = nextDue(current, new Date(y, m - 1, d, 12, 0))
    current = { ...current, due }
    dates.push(due.date)
  }
  return dates
}

describe('ical.js reads the generated file', () => {
  it('finds one event per exported task, with the stable UIDs', () => {
    expect([...events.keys()].sort()).toEqual([
      'a-weekly@taskdeck',
      'b-month31@taskdeck',
      'c-daily3@taskdeck',
      'd-completion@taskdeck',
      'e-month29@taskdeck',
    ])
  })

  it('round-trips text with commas, semicolons, backslashes, newlines, accents and emoji', () => {
    const { event, vevent } = get('a-weekly')

    expect(event.summary).toBe('Reunião semanal, sala 3; levar café ☕')
    expect(event.description).toBe(
      'Pauta:\n- números\n- próximos passos, com \\ barra\n\nPrioridade: Alta\nBaralho: Casa',
    )
    expect(vevent.getFirstProperty('categories')?.getValues()).toEqual(['trabalho', 'reunião'])
    expect(vevent.getFirstPropertyValue('priority')).toBe(1)
  })

  it('unfolds long lines with emoji back to the original title', () => {
    expect(get('c-daily3').event.summary).toBe('Regar as plantas 🌱 '.repeat(4).trim())
  })

  it('reads a timed due as floating local time with a 15-minute duration', () => {
    const { event } = get('a-weekly')

    expect(event.startDate.toString()).toBe('2026-10-07T09:30:00')
    expect(event.startDate.isDate).toBe(false)
    expect(event.startDate.zone.tzid).toBe('floating')
    expect(event.duration.toString()).toBe('PT15M')
  })

  it('reads a date-only due as an all-day event', () => {
    const { event } = get('b-month31')

    expect(event.startDate.isDate).toBe(true)
    expect(event.startDate.toString()).toBe('2026-01-31')
    expect(event.endDate.toString()).toBe('2026-02-01')
  })

  it('reads the alarm', () => {
    const alarm = get('a-weekly').vevent.getFirstSubcomponent('valarm')

    if (alarm === null) throw new Error('no alarm')
    expect(alarm.getFirstPropertyValue('action')).toBe('DISPLAY')
    expect(String(alarm.getFirstPropertyValue('trigger'))).toBe('-PT15M')
    expect(alarm.getFirstPropertyValue('description')).toBe('Reunião semanal, sala 3; levar café ☕')
  })

  it('reads the rules (frequency and interval)', () => {
    const rule = (uid: string) => {
      const value = get(uid).vevent.getFirstPropertyValue('rrule')
      return value instanceof ICAL.Recur
        ? { freq: value.freq, interval: value.interval, bymonthday: value.parts.BYMONTHDAY }
        : null
    }

    expect(rule('a-weekly')).toEqual({ freq: 'WEEKLY', interval: 1, bymonthday: undefined })
    expect(rule('c-daily3')).toEqual({ freq: 'DAILY', interval: 3, bymonthday: undefined })
    expect(rule('b-month31')).toEqual({ freq: 'MONTHLY', interval: 1, bymonthday: [-1] })
  })

  it('has no rule for a completion-anchored task or a monthly task on the 29th, and says so', () => {
    expect(get('d-completion').event.isRecurring()).toBe(false)
    expect(get('d-completion').event.description).toContain('Repete a partir da conclusão')
    expect(get('e-month29').event.isRecurring()).toBe(false)
    expect(get('e-month29').event.description).toContain('Repete todo mês no dia 29 (ou no último dia)')
  })
})

describe('ical.js expands the rules exactly like the domain', () => {
  it('weekly', () => {
    expect(expand('a-weekly', 4)).toEqual(['2026-10-07', '2026-10-14', '2026-10-21', '2026-10-28'])
  })

  it('every 3 days', () => {
    expect(expand('c-daily3', 4)).toEqual(domainSequence(sample[2] as Task, 4))
  })

  it('monthly on the 31st: 31 Jan -> 28 Feb -> 31 Mar -> 30 Apr, for a whole year', () => {
    const fromParser = expand('b-month31', 13)

    expect(fromParser.slice(0, 4)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
    expect(fromParser).toEqual(domainSequence(sample[1] as Task, 13))
  })

  it('monthly on the 31st, every 2 months, also matches the domain for two years', () => {
    const bimonthly = task('bi', {
      title: 'Bimestral',
      due: { date: '2026-08-31' },
      recurrence: { unit: 'month', every: 2, anchor: 'due' },
    })
    const vevent = parse(
      buildIcs([bimonthly], { now: NOW, alarm: 'none', labels: LABELS, deckName: () => undefined }),
    ).get('bi@taskdeck')
    if (vevent === undefined) throw new Error('missing')
    const iterator = new ICAL.Event(vevent).iterator()
    const fromParser = Array.from({ length: 12 }, () => iterator.next().toString())

    expect(fromParser.slice(0, 4)).toEqual(['2026-08-31', '2026-10-31', '2026-12-31', '2027-02-28'])
    expect(fromParser).toEqual(domainSequence(bimonthly, 12))
  })

  it('documents why days 29 and 30 have no rule: ical.js ignores BYSETPOS with BYMONTHDAY', () => {
    // The RFC-exact form for "29, or the last day" expands to every listed day here.
    const raw = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//t//EN',
      'BEGIN:VEVENT',
      'UID:x',
      'DTSTAMP:20261005T130000Z',
      'DTSTART;VALUE=DATE:20260129',
      'RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29;BYSETPOS=-1',
      'SUMMARY:x',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const vevent = ICAL.Component.fromString(raw).getFirstSubcomponent('vevent')
    if (vevent === null) throw new Error('missing')
    const iterator = new ICAL.Event(vevent).iterator()
    const dates = Array.from({ length: 4 }, () => iterator.next().toString())

    expect(dates).toEqual(['2026-01-29', '2026-02-28', '2026-03-28', '2026-03-29'])
  })

  it('monthly on the 31st in a leap year lands on 29 Feb', () => {
    const leap = task('leap', {
      title: 'Bissexto',
      due: { date: '2028-01-31' },
      recurrence: { unit: 'month', every: 1, anchor: 'due' },
    })
    const parsed = parse(buildIcs([leap], { now: NOW, alarm: 'none', labels: LABELS, deckName: () => undefined }))
    const vevent = parsed.get('leap@taskdeck')
    if (vevent === undefined) throw new Error('missing')
    const iterator = new ICAL.Event(vevent).iterator()

    expect([iterator.next(), iterator.next(), iterator.next()].map((time) => time.toString())).toEqual([
      '2028-01-31',
      '2028-02-29',
      '2028-03-31',
    ])
  })
})

describe('ical.js accepts edge cases', () => {
  it('a calendar without events', () => {
    const empty = ICAL.Component.fromString(
      buildIcs([], { now: NOW, alarm: '15m', labels: LABELS, deckName: () => undefined }),
    )

    expect(empty.name).toBe('vcalendar')
    expect(empty.getFirstPropertyValue('prodid')).toBe('-//taskdeck//EN')
    expect(empty.getAllSubcomponents('vevent')).toEqual([])
  })
})
