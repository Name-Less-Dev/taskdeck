import { afterEach, describe, expect, it, vi } from 'vitest'
import { calendarBlob, downloadBlob, jsonBlob } from './download.ts'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('downloadBlob', () => {
  it('clicks a temporary link to an object URL with the file name, then revokes the URL', () => {
    vi.useFakeTimers()
    // jsdom has no object URLs: provide them for the test.
    const create = vi.fn(() => 'blob:taskdeck/1')
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
    const clicked: { href: string; download: string }[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download })
    })
    const blob = calendarBlob('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n')

    downloadBlob(blob, 'taskdeck-2026-10-05.ics')

    expect(create).toHaveBeenCalledWith(blob)
    expect(clicked).toEqual([{ href: 'blob:taskdeck/1', download: 'taskdeck-2026-10-05.ics' }])
    expect(document.querySelector('a[download]')).toBeNull()
    expect(revoke).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revoke).toHaveBeenCalledWith('blob:taskdeck/1')
  })

  it('types calendar and JSON blobs', () => {
    expect(calendarBlob('x').type).toBe('text/calendar;charset=utf-8')
    expect(jsonBlob('{}').type).toBe('application/json')
  })
})
