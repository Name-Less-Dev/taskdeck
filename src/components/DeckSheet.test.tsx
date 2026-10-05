import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Deck, Task } from '../domain/index.ts'
import { createTask } from '../domain/index.ts'
import { renderWithI18n } from '../test/render.tsx'
import { DeckSheet, type DeckSheetProps } from './DeckSheet.tsx'

const NOW = new Date(2026, 9, 5, 10, 0)
const decks: Deck[] = [
  { id: 'home', name: 'Casa' },
  { id: 'work', name: 'Trabalho' },
]
const tasks: Task[] = [
  createTask({ deckId: 'home', title: 'A' }, { id: 'a', now: NOW }),
  createTask({ deckId: 'work', title: 'B' }, { id: 'b', now: NOW }),
  { ...createTask({ deckId: 'work', title: 'C' }, { id: 'c', now: NOW }), status: 'done', completedAt: NOW.toISOString() },
]

function renderSheet(props: Partial<DeckSheetProps> = {}) {
  const handlers = {
    onSelect: vi.fn(),
    onCreate: vi.fn((): string | null => null),
    onRename: vi.fn((): string | null => null),
    onRemove: vi.fn(),
    onClose: vi.fn(),
  }
  const result = renderWithI18n(<DeckSheet decks={decks} tasks={tasks} activeDeckId={null} {...handlers} {...props} />)
  return { ...result, ...handlers }
}

describe('DeckSheet', () => {
  it('lists "Todos os baralhos" first, then every deck with its active-task count', () => {
    renderSheet()

    const options = screen.getAllByRole('button', { name: /tarefas? ativas?/ })
    expect(options.map((option) => option.textContent)).toEqual([
      'Todos os baralhos2 tarefas ativas',
      'Casa1 tarefa ativa',
      'Trabalho1 tarefa ativa',
    ])
    expect(options[0]).toHaveAttribute('aria-current', 'true')
  })

  it('marks and focuses the active deck', () => {
    renderSheet({ activeDeckId: 'work' })

    const work = screen.getByRole('button', { name: /^Trabalho/ })
    expect(work).toHaveAttribute('aria-current', 'true')
    expect(work).toHaveFocus()
  })

  it('selects a deck or all decks', async () => {
    const { user, onSelect } = renderSheet()

    await user.click(screen.getByRole('button', { name: /^Casa/ }))
    await user.click(screen.getByRole('button', { name: /^Todos os baralhos/ }))

    expect(onSelect.mock.calls).toEqual([['home'], [null]])
  })

  it('creates a deck and shows the error the app returns', async () => {
    const onCreate = vi.fn((name: string) => (name === 'Casa' ? 'Já existe um baralho com esse nome.' : null))
    const { user } = renderSheet({ onCreate })
    const input = screen.getByLabelText('Novo baralho')

    await user.type(input, 'Casa{Enter}')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Já existe um baralho com esse nome.')

    await user.clear(input)
    await user.type(input, 'Mercado')
    await user.click(screen.getByRole('button', { name: 'Criar baralho' }))
    expect(onCreate).toHaveBeenLastCalledWith('Mercado')
    expect(input).toHaveValue('')
    expect(input).toHaveAttribute('aria-invalid', 'false')
  })

  it('renames inline, with validation and cancel', async () => {
    const onRename = vi.fn((_id: string, name: string) => (name === '' ? 'Informe um nome.' : null))
    const { user } = renderSheet({ onRename })

    await user.click(screen.getByRole('button', { name: 'Renomear Casa' }))
    const input = screen.getByLabelText('Nome do baralho')
    expect(input).toHaveValue('Casa')
    expect(input).toHaveFocus()

    await user.clear(input)
    await user.keyboard('{Enter}')
    expect(input).toHaveAccessibleDescription('Informe um nome.')

    await user.type(input, 'Lar{Enter}')
    expect(onRename).toHaveBeenLastCalledWith('home', 'Lar')
    expect(screen.queryByLabelText('Nome do baralho')).toBeNull()
  })

  it('asks for confirmation with the number of tasks that will be deleted', async () => {
    const { user, onRemove } = renderSheet()

    await user.click(screen.getByRole('button', { name: 'Apagar Trabalho' }))
    const confirm = screen.getByRole('group', { name: 'Apagar o baralho “Trabalho”?' })
    expect(confirm).toHaveTextContent('As 2 tarefas dele também serão apagadas.')
    expect(within(confirm).getByRole('button', { name: 'Cancelar' })).toHaveFocus()

    await user.click(within(confirm).getByRole('button', { name: 'Apagar baralho' }))
    expect(onRemove).toHaveBeenCalledWith('work')
  })

  it('cancelling the confirmation deletes nothing', async () => {
    const { user, onRemove } = renderSheet()

    await user.click(screen.getByRole('button', { name: 'Apagar Casa' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onRemove).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^Casa/ })).toHaveFocus()
  })

  it('refuses to delete the last deck and explains why', () => {
    renderSheet({ decks: [{ id: 'home', name: 'Casa' }] })

    const remove = screen.getByRole('button', { name: 'Apagar Casa' })
    expect(remove).toBeDisabled()
    expect(remove).toHaveAccessibleDescription('Este é o único baralho e não pode ser apagado.')
  })
})
