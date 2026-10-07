import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithI18n } from '../test/render.tsx'
import { PRACTICE_HINT_MS, PracticeDeck } from './PracticeDeck.tsx'

function renderPractice(exercises: Parameters<typeof PracticeDeck>[0]['exercises'] = ['complete', 'postpone']) {
  const onComplete = vi.fn()
  const onSkip = vi.fn()
  const result = renderWithI18n(<PracticeDeck exercises={exercises} onComplete={onComplete} onSkip={onSkip} />)
  const practice = screen.getByTestId('practice-deck')
  return { ...result, onComplete, onSkip, practice }
}

const practiceCard = (practice: HTMLElement) => practice.querySelector<HTMLElement>('[data-top-card]')
const region = (practice: HTMLElement) => within(practice).getByRole('status')

afterEach(() => {
  vi.useRealTimers()
})

describe('PracticeDeck', () => {
  it('is clearly labelled as practice and shows the first exercise on a real card', () => {
    const { practice } = renderPractice()

    expect(practice).toHaveTextContent('Prática: nada disso é salvo')
    expect(practice).toHaveTextContent('Conclua esta carta deslizando para a direita.')
    expect(within(practice).getByRole('region', { name: 'Baralho de prática' })).toBeInTheDocument()
    expect(practiceCard(practice)).toHaveAccessibleName(/^Carta de prática/)
    // The real action bar, without the keyboard legend.
    expect(within(practice).getAllByRole('button', { name: /Mais tarde|Amanhã|Apagar|Concluir/ })).toHaveLength(4)
    expect(practice.querySelector('details')).toBeNull()
  })

  it('accepts the action from a button, then from the keyboard, and reports the step done', async () => {
    const { user, practice, onComplete } = renderPractice(['complete', 'postpone'])

    await user.click(within(practice).getByRole('button', { name: 'Concluir' }))
    await waitFor(() => {
      expect(practice).toHaveTextContent('Agora, mais tarde: deslize para a esquerda.')
    })
    expect(region(practice)).toHaveTextContent('Muito bem! Agora, mais tarde: deslize para a esquerda.')

    practiceCard(practice)?.focus()
    await user.keyboard('{ArrowLeft}')

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1)
    })
    expect(region(practice)).toHaveTextContent('Muito bem! Passo concluído.')
  })

  it('ArrowDown and Delete work too (tomorrow, then delete)', async () => {
    const { user, practice, onComplete } = renderPractice(['snooze', 'remove'])

    practiceCard(practice)?.focus()
    await user.keyboard('{ArrowDown}')
    await waitFor(() => {
      expect(practice).toHaveTextContent('Agora apague: deslize para cima.')
    })
    practiceCard(practice)?.focus()
    await user.keyboard('{Delete}')

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1)
    })
  })

  it('a different action is allowed, explained kindly, and "Tentar de novo" brings the card back', async () => {
    const { user, practice, onComplete } = renderPractice(['complete', 'postpone'])

    await user.click(within(practice).getByRole('button', { name: 'Amanhã' }))

    await waitFor(() => {
      expect(practice).toHaveTextContent('Isso adiou a carta para amanhã. Agora tente concluir.')
    })
    expect(practiceCard(practice)).toBeNull()
    expect(onComplete).not.toHaveBeenCalled()

    await user.click(within(practice).getByRole('button', { name: 'Tentar de novo' }))
    expect(practiceCard(practice)).toHaveAccessibleName(/^Carta de prática/)
    expect(within(practice).queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  })

  it('"Pular este passo" is always there', async () => {
    const { user, practice, onSkip } = renderPractice()

    await user.click(within(practice).getByRole('button', { name: 'Pular este passo' }))

    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('shows a non-blocking hint after 8 seconds without success', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { practice } = renderPractice(['snooze', 'remove'])
    expect(practice).not.toHaveTextContent('Dica')

    act(() => {
      vi.advanceTimersByTime(PRACTICE_HINT_MS - 1)
    })
    expect(practice).not.toHaveTextContent('Dica')
    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(practice).toHaveTextContent('Dica: use o botão Amanhã.')
    expect(within(practice).getByRole('button', { name: 'Amanhã' })).toBeEnabled()
  })
})
