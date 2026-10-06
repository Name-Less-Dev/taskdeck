import { describe, expect, it } from 'vitest'
import { isValidTime } from '../../src/domain/index.ts'
import { maskTimeInput, normalizeTime } from '../../src/ui/time-field.ts'

/** Types `keys` one at a time from an empty field, like a keyboard would. */
function typeAll(keys: string): string {
  let value = ''
  for (const key of keys) value = maskTimeInput(value, value + key)
  return value
}

describe('maskTimeInput', () => {
  it.each([
    ['0', '0'],
    ['09', '09:'],
    ['093', '09:3'],
    ['0930', '09:30'],
    ['09305', '09:30'],
    ['9:30', '9:30'],
    ['9:3', '9:3'],
    ['a1b2c3d4', '12:34'],
    ['12::30', '12:30'],
    [':', ''],
  ])('typing "%s" shows "%s"', (keys, shown) => {
    expect(typeAll(keys)).toBe(shown)
  })

  it('keeps pasted text to HH:mm', () => {
    expect(maskTimeInput('', '1830')).toBe('18:30')
    expect(maskTimeInput('', ' 7h45 ')).toBe('74:5')
    expect(maskTimeInput('', '18:305')).toBe('18:30')
  })

  it('lets Backspace remove the colon at the end instead of adding it back', () => {
    expect(maskTimeInput('09:', '09')).toBe('09')
    expect(maskTimeInput('09', '0')).toBe('0')
    expect(maskTimeInput('09:3', '09:')).toBe('09:')
  })

  it('takes the digit before the colon when Backspace removes the colon from the middle', () => {
    expect(maskTimeInput('09:30', '0930')).toBe('03:0')
    expect(maskTimeInput('12:30', '1230')).toBe('13:0')
  })

  it('deleting a digit after the colon keeps the colon', () => {
    expect(maskTimeInput('09:30', '09:3')).toBe('09:3')
    expect(maskTimeInput('09:30', '09:0')).toBe('09:0')
  })
})

describe('normalizeTime', () => {
  it.each([
    ['9:30', '09:30'],
    ['09:30', '09:30'],
    ['9', '09:00'],
    ['18:', '18:00'],
    ['', ''],
    ['  ', ''],
    ['09:3', '09:3'],
    ['24:60', '24:60'],
  ])('"%s" becomes "%s"', (text, normalized) => {
    expect(normalizeTime(text)).toBe(normalized)
  })

  it('never turns an invalid time into a valid one', () => {
    for (const text of ['24:00', '12:60', '99', '09:3']) {
      expect(isValidTime(normalizeTime(text))).toBe(false)
    }
  })
})
