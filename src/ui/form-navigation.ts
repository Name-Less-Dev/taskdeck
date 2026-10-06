import type { KeyboardEvent } from 'react'

/** Marks the field whose Enter submits the form (the last single-line field). */
export const SUBMIT_ON_ENTER_ATTRIBUTE = 'data-submit-on-enter'

const FOCUSABLE = 'input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)'

/**
 * True while an input method (IME) is composing text: Enter then confirms the
 * composition and must not act on the form.
 */
export function isComposingKey(event: KeyboardEvent): boolean {
  // Android keyboards often report composition only as keyCode 229 (isComposing
  // stays false), and no non-deprecated property carries that signal.
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- see above
  return event.nativeEvent.isComposing || event.keyCode === 229
}

/** Single-line controls where the browser would submit the form on Enter. */
function submitsImplicitly(element: Element): element is HTMLInputElement {
  // Checkboxes are included: Enter moves on instead of submitting the form.
  return element instanceof HTMLInputElement && !['button', 'submit', 'reset', 'file', 'hidden'].includes(element.type)
}

/** Tab-order stops inside `form`: a radio group counts once (its checked radio, or the first). */
function tabStops(form: HTMLFormElement): HTMLElement[] {
  const seenGroups = new Set<string>()
  return [...form.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    if (element.tabIndex < 0) return false
    if (!(element instanceof HTMLInputElement) || element.type !== 'radio' || element.name === '') return true
    if (seenGroups.has(element.name)) return false
    const group = form.querySelectorAll<HTMLInputElement>(`input[type=radio][name="${CSS.escape(element.name)}"]`)
    const checked = [...group].find((radio) => radio.checked)
    if (checked !== undefined && checked !== element) return false
    seenGroups.add(element.name)
    return true
  })
}

/**
 * The field after `current` in tab order, or null at the end. Buttons are
 * skipped (time shortcuts, tag removal): Enter moves between fields, Tab
 * still reaches every button.
 */
export function nextField(form: HTMLFormElement, current: HTMLElement): HTMLElement | null {
  const stops = tabStops(form)
  const index = stops.indexOf(current)
  if (index === -1) return null
  return stops.slice(index + 1).find((stop) => !(stop instanceof HTMLButtonElement)) ?? null
}

/**
 * Enter behaves like "next" on mobile keyboards instead of submitting:
 * - in a single-line field (text, date, radio...) it moves to the next field, except on the field marked SUBMIT_ON_ENTER_ATTRIBUTE, which submits;
 * - in a textarea it keeps inserting a new line;
 * - Ctrl/Cmd+Enter submits from anywhere in the form;
 * - Enter while an IME is composing text is left alone.
 * A child that already handled Enter (preventDefault) wins.
 */
export function handleFormEnter(event: KeyboardEvent<HTMLFormElement>): void {
  if (event.key !== 'Enter' || event.defaultPrevented) return
  if (isComposingKey(event)) return

  const form = event.currentTarget
  const target = event.target
  if (!(target instanceof HTMLElement)) return

  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    form.requestSubmit()
    return
  }
  if (!submitsImplicitly(target) || target.hasAttribute(SUBMIT_ON_ENTER_ATTRIBUTE)) return

  event.preventDefault()
  nextField(form, target)?.focus()
}
