import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { createTask, type AppData, type Task } from './domain/index.ts'
import { DEFAULT_META } from './storage/index.ts'
import { appProps } from './test/app.tsx'
import { renderWithI18n } from './test/render.tsx'

const NOW = new Date(2026, 9, 5, 10, 0)

function task(id: string, deckId: string, title: string, extra: Partial<Task> = {}): Task {
  return { ...createTask({ deckId, title }, { id, now: NOW }), ...extra }
}

const data: AppData = {
  decks: [
    { id: 'home', name: 'Casa' },
    { id: 'work', name: 'Trabalho' },
  ],
  tasks: [
    task('h1', 'home', 'Lavar a louça', { due: { date: '2026-10-05' } }),
    task('w1', 'work', 'Enviar relatório', { due: { date: '2026-10-04' } }),
  ],
}

function renderApp(activeDeckId: string | null = null) {
  let next = 0
  return renderWithI18n(
    <App
      {...appProps(data, {
        initialMeta: { ...DEFAULT_META, settings: { activeDeckId, language: 'auto' } },
        createId: () => `new-${String(++next)}`,
      })}
    />,
  )
}

function topCard(): HTMLElement {
  return within(screen.getByTestId('top-card')).getByRole('button')
}

function switcher(): HTMLElement {
  return screen.getByRole('button', { name: /^Baralho:/ })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('deck switcher', () => {
  it('starts on the persisted deck and shows its name in the header', () => {
    renderApp('home')

    expect(switcher()).toHaveAccessibleName('Baralho: Casa')
    expect(topCard()).toHaveAccessibleName(/^Lavar a louça/)
  })

  it('switching decks changes the top card and returns focus to the switcher', async () => {
    const { user } = renderApp('home')

    await user.click(switcher())
    await user.click(screen.getByRole('button', { name: /^Trabalho/ }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(switcher()).toHaveAccessibleName('Baralho: Trabalho')
    expect(topCard()).toHaveAccessibleName(/^Enviar relatório/)
    expect(switcher()).toHaveFocus()
    expect(screen.getByText('Mostrando: Trabalho.')).toBeInTheDocument()
  })

  it('"Todos os baralhos" mixes decks and labels each card with its deck', async () => {
    const { user } = renderApp('home')

    await user.click(switcher())
    await user.click(screen.getByRole('button', { name: /^Todos os baralhos/ }))

    expect(topCard()).toHaveAccessibleName('Enviar relatório. Atrasada há 10 h. Prioridade média. Baralho Trabalho.')
    expect(within(screen.getByTestId('top-card')).getByText('Trabalho')).toBeInTheDocument()
  })

  it('closes with Escape and returns focus to the switcher', async () => {
    const { user } = renderApp()

    await user.click(switcher())
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(switcher()).toHaveFocus()
  })
})

describe('deck management', () => {
  it('creates a deck, announces it and offers undo', async () => {
    const { user } = renderApp()

    await user.click(switcher())
    await user.type(screen.getByLabelText('Novo baralho'), 'Mercado{Enter}')

    expect(screen.getByRole('button', { name: /^Mercado/ })).toBeInTheDocument()
    expect(screen.getByText('Baralho criado: Mercado. Desfazer disponível.')).toBeInTheDocument()
    expect(screen.getByTestId('undo-toast')).toHaveTextContent('Baralho criado')

    await user.click(within(screen.getByTestId('undo-toast')).getByRole('button', { name: 'Desfazer' }))
    expect(screen.queryByRole('button', { name: /^Mercado/ })).toBeNull()
  })

  it('rejects a duplicate name, ignoring case', async () => {
    const { user } = renderApp()

    await user.click(switcher())
    await user.type(screen.getByLabelText('Novo baralho'), 'casa{Enter}')

    expect(screen.getByLabelText('Novo baralho')).toHaveAccessibleDescription('Já existe um baralho com esse nome.')
  })

  it('renames the active deck and the header follows', async () => {
    const { user } = renderApp('home')

    await user.click(switcher())
    await user.click(screen.getByRole('button', { name: 'Renomear Casa' }))
    const input = screen.getByLabelText('Nome do baralho')
    await user.clear(input)
    await user.type(input, 'Lar{Enter}')
    await user.keyboard('{Escape}')

    expect(switcher()).toHaveAccessibleName('Baralho: Lar')
  })

  it('deletes a deck with its tasks after confirmation, and undo brings both back', async () => {
    const { user } = renderApp('work')

    await user.click(switcher())
    await user.click(screen.getByRole('button', { name: 'Apagar Trabalho' }))
    expect(screen.getByText('A tarefa dele também será apagada.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Apagar baralho' }))

    expect(screen.queryByRole('button', { name: /^Trabalho/ })).toBeNull()
    expect(screen.getByText('Baralho apagado: Trabalho, com 1 tarefa. Desfazer disponível.')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    // The active deck is gone: the app falls back to "Todos os baralhos".
    expect(switcher()).toHaveAccessibleName('Baralho: Todos os baralhos')
    expect(topCard()).toHaveAccessibleName(/^Lavar a louça/)

    await user.click(within(screen.getByTestId('undo-toast')).getByRole('button', { name: 'Desfazer' }))
    await waitFor(() => {
      expect(switcher()).toHaveAccessibleName('Baralho: Trabalho')
    })
    expect(topCard()).toHaveAccessibleName(/^Enviar relatório/)
  })

  it('never deletes the last deck', async () => {
    const { user } = renderWithI18n(<App {...appProps({ decks: [{ id: 'only', name: 'Geral' }], tasks: [] })} />)

    await user.click(switcher())

    expect(screen.getByRole('button', { name: 'Apagar Geral' })).toBeDisabled()
  })
})
