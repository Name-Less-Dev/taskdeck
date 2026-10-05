import { describe, expect, it } from 'vitest'
import { getDueStatus, SOON_WINDOW_MINUTES, type Due } from '../../src/domain/index.ts'
import { NOW } from './fixtures.ts'

describe('getDueStatus', () => {
  it('returns "none" without a due date', () => {
    expect(getDueStatus(null, NOW)).toEqual({ kind: 'none' })
  })

  it('keeps a date-only due today as "today" until the end of the day', () => {
    expect(getDueStatus({ date: '2026-10-05' }, NOW)).toEqual({ kind: 'today' })
  })

  it('marks a date-only due yesterday as overdue since the end of yesterday', () => {
    // Yesterday ended at 23:59:59.999, so at 10:00 it is 600 whole minutes late.
    expect(getDueStatus({ date: '2026-10-04' }, NOW)).toEqual({ kind: 'overdue', overdueMinutes: 600 })
  })

  it('marks a due earlier today as overdue with the elapsed minutes', () => {
    expect(getDueStatus({ date: '2026-10-05', time: '08:30' }, NOW)).toEqual({
      kind: 'overdue',
      overdueMinutes: 90,
    })
  })

  it('treats a due exactly at now as overdue by 0 minutes', () => {
    expect(getDueStatus({ date: '2026-10-05', time: '10:00' }, NOW)).toEqual({
      kind: 'overdue',
      overdueMinutes: 0,
    })
  })

  it('marks a due in 2 hours as soon, 120 minutes away', () => {
    expect(getDueStatus({ date: '2026-10-05', time: '12:00' }, NOW)).toEqual({ kind: 'soon', inMinutes: 120 })
  })

  it('includes the exact edge of the soon window', () => {
    expect(SOON_WINDOW_MINUTES).toBe(180)
    expect(getDueStatus({ date: '2026-10-05', time: '13:00' }, NOW)).toEqual({ kind: 'soon', inMinutes: 180 })
    expect(getDueStatus({ date: '2026-10-05', time: '13:01' }, NOW)).toEqual({ kind: 'today' })
  })

  it('rounds the minutes left up so a soon card never shows 0 minutes', () => {
    const now = new Date(2026, 9, 5, 11, 59, 30)

    expect(getDueStatus({ date: '2026-10-05', time: '12:00' }, now)).toEqual({ kind: 'soon', inMinutes: 1 })
  })

  it('keeps a due in 5 hours as "today"', () => {
    expect(getDueStatus({ date: '2026-10-05', time: '15:00' }, NOW)).toEqual({ kind: 'today' })
  })

  it('never marks a date-only due as soon, even close to midnight', () => {
    const now = new Date(2026, 9, 5, 23, 0)

    expect(getDueStatus({ date: '2026-10-05' }, now)).toEqual({ kind: 'today' })
  })

  it('does not mark a date-only due as overdue at 23:59 of that day', () => {
    const now = new Date(2026, 9, 5, 23, 59)

    expect(getDueStatus({ date: '2026-10-05' }, now)).toEqual({ kind: 'today' })
  })

  it('marks a date-only due as overdue at 00:00 of the next day', () => {
    const now = new Date(2026, 9, 6, 0, 0)

    expect(getDueStatus({ date: '2026-10-05' }, now)).toEqual({ kind: 'overdue', overdueMinutes: 0 })
  })

  it('uses "soon" for a timed due shortly after midnight, even if it is tomorrow', () => {
    const now = new Date(2026, 9, 5, 23, 0)

    expect(getDueStatus({ date: '2026-10-06', time: '01:00' }, now)).toEqual({ kind: 'soon', inMinutes: 120 })
  })

  it.each<[string, Due, ReturnType<typeof getDueStatus>]>([
    ['tomorrow, date only', { date: '2026-10-06' }, { kind: 'tomorrow' }],
    ['tomorrow at 08:00', { date: '2026-10-06', time: '08:00' }, { kind: 'tomorrow' }],
    ['in 2 days', { date: '2026-10-07' }, { kind: 'week', inDays: 2 }],
    ['in 3 days', { date: '2026-10-08' }, { kind: 'week', inDays: 3 }],
    ['in 7 days', { date: '2026-10-12', time: '09:00' }, { kind: 'week', inDays: 7 }],
    ['in 8 days', { date: '2026-10-13' }, { kind: 'later', inDays: 8 }],
    ['next year', { date: '2027-10-05' }, { kind: 'later', inDays: 365 }],
  ])('classifies a due %s', (_label, due, expected) => {
    expect(getDueStatus(due, NOW)).toEqual(expected)
  })

  it('counts calendar days, so a due tomorrow at 00:30 is "tomorrow" late at night', () => {
    const now = new Date(2026, 9, 5, 20, 0)

    expect(getDueStatus({ date: '2026-10-06', time: '00:30' }, now)).toEqual({ kind: 'tomorrow' })
  })
})
