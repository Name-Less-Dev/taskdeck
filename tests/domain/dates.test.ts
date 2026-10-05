import { describe, expect, it } from 'vitest'
import {
  addMonthsOnDay,
  addToDayKey,
  calendarDaysBetween,
  dayKeyToDate,
  dueInstant,
  dueToDate,
  isoToTime,
  isSameLocalDay,
  toDayKey,
} from '../../src/domain/index.ts'
import { localIso, NOW } from './fixtures.ts'

describe('date helpers', () => {
  it('formats the local day of an instant', () => {
    expect(toDayKey(NOW)).toBe('2026-10-05')
    expect(toDayKey(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05')
    expect(toDayKey(new Date(2026, 9, 6, 0, 0))).toBe('2026-10-06')
  })

  it('parses a day key to local midnight', () => {
    expect(dayKeyToDate('2026-10-05')).toEqual(new Date(2026, 9, 5))
  })

  it('converts a due date to local wall-clock time', () => {
    expect(dueToDate({ date: '2026-10-05' })).toEqual(new Date(2026, 9, 5, 0, 0))
    expect(dueToDate({ date: '2026-10-05', time: '18:45' })).toEqual(new Date(2026, 9, 5, 18, 45))
  })

  it('uses the end of the local day as the instant of a date-only due', () => {
    expect(dueInstant({ date: '2026-10-05' })).toEqual(new Date(2026, 9, 5, 23, 59, 59, 999))
    expect(dueInstant({ date: '2026-10-05', time: '08:00' })).toEqual(new Date(2026, 9, 5, 8, 0))
  })

  it('counts calendar days, not 24-hour periods', () => {
    expect(calendarDaysBetween(new Date(2026, 9, 6, 0, 1), new Date(2026, 9, 5, 23, 59))).toBe(1)
    expect(calendarDaysBetween(new Date(2026, 9, 5, 23, 59), new Date(2026, 9, 5, 0, 0))).toBe(0)
    expect(calendarDaysBetween(new Date(2026, 9, 4), NOW)).toBe(-1)
  })

  it('compares an ISO instant with a local day', () => {
    expect(isSameLocalDay(localIso(2026, 9, 5, 0, 0), NOW)).toBe(true)
    expect(isSameLocalDay(localIso(2026, 9, 5, 23, 59), NOW)).toBe(true)
    expect(isSameLocalDay(localIso(2026, 9, 4, 23, 59), NOW)).toBe(false)
  })

  it('converts ISO instants to comparable numbers', () => {
    expect(isoToTime(localIso(2026, 9, 5, 10, 0))).toBe(NOW.getTime())
  })

  it('adds days, weeks and months to a day key', () => {
    expect(addToDayKey('2026-10-30', 'day', 3)).toBe('2026-11-02')
    expect(addToDayKey('2026-12-29', 'week', 1)).toBe('2027-01-05')
    expect(addToDayKey('2026-01-31', 'month', 1)).toBe('2026-02-28')
  })

  it('adds months landing on a day clamped to the month length', () => {
    expect(addMonthsOnDay('2026-01-31', 1, 31)).toBe('2026-02-28')
    expect(addMonthsOnDay('2026-02-28', 1, 31)).toBe('2026-03-31')
    expect(addMonthsOnDay('2028-01-31', 1, 31)).toBe('2028-02-29')
    expect(addMonthsOnDay('2026-11-30', 2, 30)).toBe('2027-01-30')
  })
})
