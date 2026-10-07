import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/index.tsx'
import { UNDO_TOAST_MS, UndoToast, type ToastData } from './UndoToast.tsx'

const TOAST: ToastData = { id: 1, message: 'Tarefa concluída' }

function renderToast(toast: ToastData | null = TOAST) {
  const onUndo = vi.fn()
  const onDismiss = vi.fn()
  const result = render(
    <I18nProvider locale="pt-BR">
      <UndoToast toast={toast} onUndo={onUndo} onDismiss={onDismiss} />
    </I18nProvider>,
  )
  return { ...result, onUndo, onDismiss }
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('UndoToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows "message · Desfazer" and calls onUndo from its button', () => {
    const { onUndo } = renderToast()

    expect(screen.getByTestId('undo-toast')).toHaveTextContent('Tarefa concluída·Desfazer')
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('shows a plain notice without the Undo button when not undoable', () => {
    renderToast({ id: 2, message: 'Arquivo baixado.', undoable: false })

    expect(screen.getByTestId('undo-toast')).toHaveTextContent('Arquivo baixado.')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders nothing without a toast', () => {
    renderToast(null)

    expect(screen.queryByTestId('undo-toast')).toBeNull()
  })

  it('dismisses itself after 6 seconds', () => {
    const { onDismiss } = renderToast()

    advance(UNDO_TOAST_MS - 1)
    expect(onDismiss).not.toHaveBeenCalled()
    advance(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(UNDO_TOAST_MS).toBe(6000)
  })

  it('pauses while hovered and resumes with the remaining time', () => {
    const { onDismiss } = renderToast()

    advance(4000)
    fireEvent.mouseEnter(screen.getByTestId('undo-toast'))
    advance(30_000)
    expect(onDismiss).not.toHaveBeenCalled()

    fireEvent.mouseLeave(screen.getByTestId('undo-toast'))
    advance(1999)
    expect(onDismiss).not.toHaveBeenCalled()
    advance(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('pauses while focus is inside it', () => {
    const { onDismiss } = renderToast()
    const button = screen.getByRole('button', { name: 'Desfazer' })

    act(() => {
      button.focus()
    })
    advance(30_000)
    expect(onDismiss).not.toHaveBeenCalled()

    act(() => {
      button.blur()
    })
    advance(UNDO_TOAST_MS)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('restarts the countdown for a new toast', () => {
    const { onDismiss, rerender } = renderToast()

    advance(5000)
    rerender(
      <I18nProvider locale="pt-BR">
        <UndoToast toast={{ id: 2, message: 'Para mais tarde' }} onUndo={vi.fn()} onDismiss={onDismiss} />
      </I18nProvider>,
    )
    advance(5000)
    expect(onDismiss).not.toHaveBeenCalled()
    advance(1000)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not steal focus when it appears', () => {
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()

    renderToast()

    expect(document.activeElement).toBe(outside)
    outside.remove()
  })
})
