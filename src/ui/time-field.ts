/** Shortcut values offered next to the time field. */
export const TIME_SHORTCUTS = ['09:00', '12:00', '18:00'] as const

const MAX_LENGTH = 5

/**
 * Keeps the time field to "HH:mm" while typing: digits only, at most two
 * before and two after the colon, a colon inserted after two digits.
 * `previous` tells deleting from typing: a colon removed with Backspace is
 * not added back, and Backspace right after the colon also takes the digit
 * before it (the colon alone cannot be deleted from the middle).
 */
export function maskTimeInput(previous: string, raw: string): string {
  const deleting = raw.length < previous.length
  const colon = raw.indexOf(':')
  if (colon !== -1) {
    const hours = digits(raw.slice(0, colon)).slice(0, 2)
    const minutes = digits(raw.slice(colon + 1)).slice(0, 2)
    // A colon with nothing before it means nothing yet.
    return hours === '' ? minutes : `${hours}:${minutes}`.slice(0, MAX_LENGTH)
  }

  let typed = digits(raw).slice(0, 4)
  const removedColonAt = previous.indexOf(':')
  const colonInMiddle = removedColonAt !== -1 && removedColonAt < previous.length - 1
  if (deleting && colonInMiddle && digits(previous) === typed) {
    // Only the colon went away: delete the digit before it too.
    typed = typed.slice(0, removedColonAt - 1) + typed.slice(removedColonAt)
  }
  if (typed.length > 2) return `${typed.slice(0, 2)}:${typed.slice(2)}`
  if (typed.length === 2 && !deleting) return `${typed}:`
  return typed
}

/**
 * Completes what the person typed when leaving the field: "9:30" -> "09:30",
 * "9" or "9:" -> "09:00". Anything else is returned unchanged (trimmed) for
 * validation to judge; "" stays "" (no time).
 */
export function normalizeTime(text: string): string {
  const value = text.trim()
  const full = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (full !== null) return `${(full[1] ?? '').padStart(2, '0')}:${full[2] ?? ''}`
  const hoursOnly = /^(\d{1,2}):?$/.exec(value)
  if (hoursOnly !== null) return `${(hoursOnly[1] ?? '').padStart(2, '0')}:00`
  return value
}

function digits(text: string): string {
  return text.replace(/\D/g, '')
}
