import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { Deck } from './components/Deck.tsx'
import { createTask, type Task } from './domain/index.ts'
import { appProps } from './test/app.tsx'
import { renderWithI18n, topCard } from './test/render.tsx'

/**
 * Regression: a card that animated out but stays in the deck (postponed, or a
 * recurring task completed) kept its exit transform and opacity 0, so it came
 * back to the top invisible and off-screen: drag hit nothing and only the
 * buttons worked. An exit cancelled because the card lost the top never
 * committed, leaving every action blocked.
 */

const NOW = new Date(2026, 9, 5, 10, 0)

function task(id: string, title: string, extra: Partial<Task> = {}): Task {
  return { ...createTask({ deckId: 'd', title }, { id, now: NOW }), ...extra }
}

function expectAtOrigin(card: HTMLElement) {
  expect(card.style.opacity).toBe('1')
  expect(card.style.transform).toBe('none')
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('cards that exit but stay in the deck', () => {
  it('a postponed card comes back visible and at the origin', async () => {
    const a = task('a', 'Atrasada', { due: { date: '2026-10-01' } })
    const { user } = renderWithI18n(<App {...appProps({ decks: [{ id: 'd', name: 'G' }], tasks: [a, task('b', 'Outra')] })} />)
    const cardA = topCard()

    await user.click(screen.getByRole('button', { name: 'Adiar' }))
    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/^Outra/)
    })
    // Same element (same key), now underneath: it must not stay transparent/off-screen.
    expect(cardA.isConnected).toBe(true)
    expectAtOrigin(cardA)

    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/^Atrasada/)
    })
    expect(topCard()).toBe(cardA)
    expectAtOrigin(topCard())
  })

  it('a completed recurring card comes back visible further down', async () => {
    const weekly = task('w', 'Lavar a roupa', {
      due: { date: '2026-10-03' },
      recurrence: { unit: 'week', every: 1, anchor: 'due' },
    })
    const { user } = renderWithI18n(<App {...appProps({ decks: [{ id: 'd', name: 'G' }], tasks: [weekly, task('t', 'Hoje', { due: { date: '2026-10-05' } })] })} />)
    const cardW = topCard()

    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/^Hoje/)
    })

    expect(cardW.isConnected).toBe(true)
    expectAtOrigin(cardW)
  })

  it('actions keep working after a card comes back (nothing stays locked)', async () => {
    const { user } = renderWithI18n(<App {...appProps({ decks: [{ id: 'd', name: 'G' }], tasks: [task('a', 'A'), task('b', 'B')] })} />)

    await user.click(screen.getByRole('button', { name: 'Adiar' }))
    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/^B/)
    })
    await user.click(screen.getByRole('button', { name: 'Adiar' }))
    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/^A/)
    })

    expect(screen.getByRole('button', { name: 'Concluir' })).toBeEnabled()
    expect(screen.getAllByRole('button', { name: 'Desfazer' })[0]).toBeEnabled()
  })
})

describe('an exit interrupted because the card lost the top', () => {
  it('keeps animating the card out and reports when it finishes', async () => {
    const onExited = vi.fn()
    const onExitInterrupted = vi.fn()
    const a = task('a', 'A')
    const b = task('b', 'B')

    render(
      <Deck
        tasks={[b, a]}
        now={NOW}
        flippedId={null}
        exiting={{ id: 'a', action: 'complete' }}
        onFlip={vi.fn()}
        onRequestAction={vi.fn()}
        onExited={onExited}
        onExitInterrupted={onExitInterrupted}
      />,
    )

    await waitFor(() => {
      expect(onExited).toHaveBeenCalledWith('a')
    })
  })

  it('reports an interruption when the exiting card is unmounted', () => {
    const onExitInterrupted = vi.fn()
    const a = task('a', 'A')
    const props = {
      now: NOW,
      flippedId: null,
      exiting: { id: 'a', action: 'complete' } as const,
      onFlip: vi.fn(),
      onRequestAction: vi.fn(),
      onExited: vi.fn(),
      onExitInterrupted,
    }
    const { rerender } = render(<Deck tasks={[a]} {...props} />)

    // Filtered out mid-animation (e.g. a tag filter): the card unmounts.
    rerender(<Deck tasks={[]} {...props} />)

    expect(onExitInterrupted).toHaveBeenCalledWith('a')
  })
})
