import { describe, expect, it } from 'vitest'
import { DueSchema, isValidTime } from '../../src/domain/index.ts'

describe('isValidTime', () => {
  it.each(['00:00', '09:30', '12:00', '23:59'])('accepts %s', (value) => {
    expect(isValidTime(value)).toBe(true)
  })

  it.each(['24:00', '12:60', '9:30', '0930', '09:30:00', '', '24:60', 'ab:cd'])('rejects "%s"', (value) => {
    expect(isValidTime(value)).toBe(false)
  })

  it('follows the same rule as the time of a due date', () => {
    for (const time of ['07:05', '24:00', '9:30']) {
      expect(isValidTime(time)).toBe(DueSchema.safeParse({ date: '2026-10-05', time }).success)
    }
  })
})
