import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { createTask } from './domain/index.ts'
import { AUTOSAVE_DELAY_MS, createMemoryStorage } from './storage/index.ts'
import { appProps } from './test/app.tsx'
import { renderWithI18n } from './test/render.tsx'

const NOW = new Date(2026, 9, 5, 10, 0)
const real = createTask({ deckId: 'home', title: 'Tarefa de verdade' }, { id: 'real', now: NOW })
const DATA = { decks: [{ id: 'home', name: 'Casa' }], tasks: [real] }

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('practice isolation', () => {
  it('doing every exercise never touches the real deck, its history, its live region or storage', async () => {
    const storage = createMemoryStorage({ createId: () => 'g', names: { general: 'Geral', recovered: 'Recuperadas' } })
    const save = vi.spyOn(storage, 'save')
    const { user } = renderWithI18n(<App {...appProps(DATA, { storage, openHowToOnLoad: true })} />)
    const sheet = screen.getByRole('dialog', { name: 'Como usar' })
    const appRegion = screen.getAllByRole('status').find((element) => !sheet.contains(element))
    const realDeck = screen.getByRole('region', { name: 'Baralho de tarefas' })
    const before = realDeck.textContent

    await user.click(within(sheet).getByRole('button', { name: 'Próximo' }))
    const practice = () => within(sheet).getByTestId('practice-deck')
    const progress = () => within(sheet).getByTestId('how-to-progress')

    await user.click(within(practice()).getByRole('button', { name: 'Concluir' }))
    await waitFor(() => {
      expect(practice()).toHaveTextContent('Agora, mais tarde: deslize para a esquerda.')
    })
    await user.click(within(practice()).getByRole('button', { name: 'Mais tarde' }))
    await waitFor(() => {
      expect(progress()).toHaveTextContent('Passo 3 de 5')
    })
    await user.click(within(practice()).getByRole('button', { name: 'Amanhã' }))
    await waitFor(() => {
      expect(practice()).toHaveTextContent('Agora apague: deslize para cima.')
    })
    await user.click(within(practice()).getByRole('button', { name: 'Apagar' }))
    await waitFor(() => {
      expect(progress()).toHaveTextContent('Passo 4 de 5')
    })

    // Longer than the autosave delay: nothing was scheduled.
    await wait(AUTOSAVE_DELAY_MS + 100)
    expect(save).not.toHaveBeenCalled()
    expect(storage.snapshot().tasks).toEqual([])
    expect(realDeck.textContent).toBe(before)
    expect(within(realDeck).getByRole('button', { name: /^Tarefa de verdade/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Desfazer' })[0]).toBeDisabled()
    expect(appRegion).toHaveTextContent('')
  })
})
