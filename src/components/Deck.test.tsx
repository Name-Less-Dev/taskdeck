import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.tsx'
import { createTask, type Task } from '../domain/index.ts'
import { I18nProvider } from '../i18n/index.tsx'
import { appProps } from '../test/app.tsx'
import { renderWithI18n, topCard } from '../test/render.tsx'
import { Deck, type DeckProps } from './Deck.tsx'

const NOW = new Date(2026, 9, 5, 10, 0)

function task(id: string, title: string, extra: Partial<Task> = {}): Task {
  return { ...createTask({ deckId: 'd', title }, { id, now: NOW }), ...extra }
}

function deckProps(tasks: readonly Task[]): DeckProps {
  return {
    tasks,
    now: NOW,
    flippedId: null,
    exiting: null,
    onFlip: vi.fn(),
    onRequestAction: vi.fn(),
    onExited: vi.fn(),
  }
}

/** The card element (motion.div) rendered for a task title, top card or not. */
function cardFor(title: string): Element | null {
  return [...document.querySelectorAll('h2')].find((heading) => heading.textContent === title)?.closest('[class*=card]') ?? null
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Deck keys', () => {
  it('keys cards by task id: reordering keeps each card element, a new task gets a new one', () => {
    const a = task('a', 'A')
    const b = task('b', 'B')
    // A wrapper (not a parent element) so rerender keeps the provider and the tree.
    const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider locale="pt-BR">{children}</I18nProvider>
    const { rerender } = render(<Deck {...deckProps([a, b])} />, { wrapper })
    const cardA = cardFor('A')
    const cardB = cardFor('B')

    rerender(<Deck {...deckProps([b, a])} />)
    expect(cardFor('A')).toBe(cardA)
    expect(cardFor('B')).toBe(cardB)

    // Same position as A had, different id: must not reuse A's element (and its state).
    rerender(<Deck {...deckProps([task('c', 'C'), b])} />)
    expect(cardFor('C')).not.toBe(cardA)
    expect(cardA?.isConnected).toBe(false)
  })
})

describe('no state leaks from one top card to the next', () => {
  it('a new top card is not flipped, visible and at the origin', async () => {
    const { user } = renderWithI18n(<App {...appProps({ decks: [{ id: 'd', name: 'G' }], tasks: [task('a', 'A'), task('b', 'B')] })} />)

    await user.click(topCard())
    expect(topCard()).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Concluir' }))

    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/^B/)
    })
    expect(topCard()).toHaveAttribute('aria-pressed', 'false')
    expect(topCard().style.opacity).toBe('1')
    expect(topCard().style.transform).toBe('none')
  })

  it('a card that comes back to the top is not flipped any more and accepts actions', async () => {
    const { user } = renderWithI18n(<App {...appProps({ decks: [{ id: 'd', name: 'G' }], tasks: [task('a', 'A'), task('b', 'B')] })} />)

    await user.click(topCard())
    await user.click(screen.getByRole('button', { name: 'Mais tarde' }))
    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/^B/)
    })
    await user.click(screen.getByRole('button', { name: 'Mais tarde' }))
    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/^A/)
    })

    expect(topCard()).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/^B/)
    })
  })
})
