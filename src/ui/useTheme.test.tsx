import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { THEME_STORAGE_KEY } from './theme.ts'
import { readStoredTheme, useTheme } from './useTheme.ts'

/** A matchMedia whose "prefers dark" answer can change during the test. */
function fakeSystem(dark: boolean) {
  const listeners = new Set<() => void>()
  const state = { dark }
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        get matches() {
          return query === '(prefers-color-scheme: dark)' && state.dark
        },
        media: query,
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      }) as unknown as MediaQueryList,
  )
  return {
    setDark(next: boolean) {
      state.dark = next
      for (const listener of listeners) listener()
    },
  }
}

const root = document.documentElement

afterEach(() => {
  vi.restoreAllMocks()
  delete root.dataset.theme
  delete root.dataset.themeChoice
})

describe('useTheme', () => {
  it('starts from the saved theme and puts it on <html>', () => {
    fakeSystem(false)
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify('neon'))

    const { result } = renderHook(() => useTheme())

    expect(result.current[0]).toBe('neon')
    expect(root.dataset.theme).toBe('neon')
    expect(root.dataset.themeChoice).toBe('neon')
  })

  it('"auto" follows the system as it changes', () => {
    const system = fakeSystem(false)
    renderHook(() => useTheme())
    expect(root.dataset.theme).toBe('light')

    act(() => {
      system.setDark(true)
    })
    expect(root.dataset.theme).toBe('dark')
    expect(root.dataset.themeChoice).toBe('auto')
  })

  it('a chosen theme ignores the system, applies at once and is saved as JSON', () => {
    const system = fakeSystem(false)
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current[1]('lilac')
    })
    act(() => {
      system.setDark(true)
    })

    expect(root.dataset.theme).toBe('lilac')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('"lilac"')
  })

  it('reads broken or unavailable storage as "auto"', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, '{not json')
    expect(readStoredTheme()).toBe('auto')

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readStoredTheme()).toBe('auto')
  })
})
