import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.tsx'
import { createTask } from '../domain/index.ts'
import { I18nProvider } from '../i18n/index.tsx'
import { DEFAULT_NOW_INTERVAL_MS, useNow } from './useNow.ts'

const LATE_EVENING = new Date(2026, 9, 5, 23, 59, 0)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(LATE_EVENING)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useNow', () => {
  it('refreshes every 30 seconds by default', () => {
    const { result } = renderHook(() => useNow())
    expect(result.current).toEqual(LATE_EVENING)
    expect(DEFAULT_NOW_INTERVAL_MS).toBe(30_000)

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(result.current).toEqual(new Date(2026, 9, 5, 23, 59, 30))
  })

  it('refreshes when the tab becomes visible again', () => {
    const { result } = renderHook(() => useNow(60_000))
    vi.setSystemTime(new Date(2026, 9, 6, 8, 0))

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(result.current).toEqual(new Date(2026, 9, 6, 8, 0))
  })

  it('stops the timer and the listener on unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const { unmount } = renderHook(() => useNow())

    unmount()

    expect(clearSpy).toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('makes a due badge change from "Hoje" to "Atrasada" when midnight passes', () => {
    const task = createTask(
      { deckId: 'd', title: 'Enviar relatório', due: { date: '2026-10-05' } },
      { id: 't', now: LATE_EVENING },
    )
    render(
      <I18nProvider locale="pt-BR">
        <App initialData={{ decks: [{ id: 'd', name: 'Geral' }], tasks: [task] }} />
      </I18nProvider>,
    )
    expect(screen.getByText('Hoje')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(screen.queryByText('Hoje')).toBeNull()
    expect(screen.getByText('Atrasada agora')).toBeInTheDocument()
  })
})
