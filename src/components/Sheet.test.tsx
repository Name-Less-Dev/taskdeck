import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithI18n } from '../test/render.tsx'
import { Sheet } from './Sheet.tsx'

function renderSheet() {
  const onClose = vi.fn()
  const result = renderWithI18n(
    <Sheet title="Folha" onClose={onClose}>
      <label>
        <input type="checkbox" /> Opção
      </label>
    </Sheet>,
  )
  return { ...result, onClose }
}

describe('Sheet and Escape', () => {
  it('closes on Escape from a control inside it', () => {
    const { onClose } = renderSheet()

    fireEvent.keyDown(screen.getByRole('checkbox'), { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('also closes on Escape when focus sits on <body> (Safari does not focus a clicked checkbox or button)', () => {
    const { onClose } = renderSheet()
    // What WebKit leaves after a click on a checkbox inside the sheet.
    ;(document.activeElement as HTMLElement | null)?.blur()
    expect(document.body).toHaveFocus()

    fireEvent.keyDown(document.body, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores an Escape another handler already used', () => {
    const { onClose } = renderSheet()
    ;(document.activeElement as HTMLElement | null)?.blur()
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    event.preventDefault()

    document.body.dispatchEvent(event)

    expect(onClose).not.toHaveBeenCalled()
  })
})
