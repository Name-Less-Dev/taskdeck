import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { createTask, type AppData, type Task } from './domain/index.ts'
import { appProps } from './test/app.tsx'
import { renderWithI18n, topCard } from './test/render.tsx'

const NOW = new Date(2026, 9, 5, 10, 0)

function task(id: string, title: string, tags: string[], extra: Partial<Task> = {}): Task {
  return { ...createTask({ deckId: 'home', title, tags }, { id, now: NOW }), ...extra }
}

const data: AppData = {
  decks: [{ id: 'home', name: 'Casa' }],
  tasks: [
    task('a', 'Lavar a louça', ['casa', 'rapida'], { due: { date: '2026-10-04' } }),
    task('b', 'Pagar contas', ['casa', 'dinheiro', 'mensal', 'banco'], { due: { date: '2026-10-05' } }),
    task('c', 'Ler um livro', ['lazer']),
    task('r', 'Lavar a roupa', ['casa'], {
      due: { date: '2026-10-07' },
      recurrence: { unit: 'week', every: 1, anchor: 'due' },
      postponedDays: 2,
    }),
  ],
}

function renderApp() {
  return renderWithI18n(<App {...appProps(data)} />)
}

function filterBar(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Filtrar por tag' })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('tags on cards', () => {
  it('shows up to 3 tags on the front plus "+N"', () => {
    renderApp()
    // Second card: 4 tags.
    const lists = screen.getAllByRole('list', { name: 'Tags', hidden: true })
    const fourTags = lists.find((list) => list.textContent.includes('#dinheiro'))

    expect(fourTags).toHaveTextContent('#casa#dinheiro#mensal+1')
    expect(within(fourTags as HTMLElement).getByText('+1', { exact: true })).toHaveAttribute('aria-label', 'mais 1 tag')
  })

  it('lists every tag on the back', async () => {
    const { user } = renderApp()

    await user.click(topCard())

    expect(topCard()).toHaveAccessibleDescription(/Tags #casa #rapida/)
  })
})

describe('tag filter', () => {
  it('lists the tags of active tasks with counts, most used first', () => {
    renderApp()

    expect(
      within(filterBar())
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['casa, 3 tarefas', 'banco, 1 tarefa', 'dinheiro, 1 tarefa', 'lazer, 1 tarefa', 'mensal, 1 tarefa', 'rapida, 1 tarefa'])
  })

  it('filters the deck, marks the pressed tag and announces it; "Limpar" removes the filter', async () => {
    const { user } = renderApp()

    await user.click(within(filterBar()).getByRole('button', { name: 'lazer, 1 tarefa' }))

    expect(within(filterBar()).getByRole('button', { name: 'lazer, 1 tarefa' })).toHaveAttribute('aria-pressed', 'true')
    expect(topCard()).toHaveAccessibleName(/^Ler um livro/)
    expect(screen.getByText('Filtro #lazer: 1 tarefa.')).toBeInTheDocument()

    await user.click(within(filterBar()).getByRole('button', { name: 'Limpar' }))
    expect(topCard()).toHaveAccessibleName(/^Lavar a louça/)
    expect(screen.getByText('Filtro de tag removido.')).toBeInTheDocument()
  })

  it('shows a specific empty state with "Limpar filtro" when nothing is left', async () => {
    const { user } = renderApp()

    await user.click(within(filterBar()).getByRole('button', { name: 'lazer, 1 tarefa' }))
    topCard().focus()
    await user.keyboard('{ArrowRight}')

    expect(await screen.findByRole('heading', { name: 'Nada com #lazer' })).toBeInTheDocument()
    // The active tag stays visible with a 0 count so the filter is never hidden.
    expect(within(filterBar()).getByRole('button', { name: 'lazer, 0 tarefas' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Limpar filtro' }))
    expect(topCard()).toHaveAccessibleName(/^Lavar a louça/)
  })

  it('is hidden when no task has tags', () => {
    renderWithI18n(<App {...appProps({ decks: data.decks, tasks: [task('x', 'Sem tags', [])] })} />)

    expect(screen.queryByRole('navigation', { name: 'Filtrar por tag' })).toBeNull()
  })
})

describe('editing', () => {
  it('edits from the "Editar" button on the back, then returns focus to the deck', async () => {
    const { user } = renderApp()

    await user.click(topCard())
    await user.click(screen.getByRole('button', { name: 'Editar a tarefa Lavar a louça' }))
    const dialog = screen.getByRole('dialog', { name: 'Editar tarefa' })
    const title = within(dialog).getByLabelText('Título')
    await user.clear(title)
    await user.type(title, 'Lavar a louça do jantar{Enter}')

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/^Lavar a louça do jantar/)
    })
    expect(topCard()).toHaveFocus()
    expect(screen.getByText('Tarefa atualizada: Lavar a louça do jantar. Desfazer disponível.')).toBeInTheDocument()
    expect(screen.getByTestId('undo-toast')).toHaveTextContent('Tarefa atualizada')
  })

  it('opens the editor with "E" on the focused card', async () => {
    const { user } = renderApp()

    topCard().focus()
    await user.keyboard('e')

    expect(screen.getByRole('dialog', { name: 'Editar tarefa' })).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('Lavar a louça')
  })

  it('keeps the recurrence and counters of a recurring task, and undo restores the old version', async () => {
    const { user } = renderApp()
    await user.click(within(filterBar()).getByRole('button', { name: 'casa, 3 tarefas' }))
    // Order with #casa: overdue "Lavar a louça", today "Pagar contas", then the weekly task.
    topCard().focus()
    await user.keyboard('{ArrowLeft}')
    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/^Pagar contas/)
    })
    topCard().focus()
    await user.keyboard('{ArrowLeft}')
    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/^Lavar a roupa/)
    })

    topCard().focus()
    await user.keyboard('e')
    const title = screen.getByLabelText('Título')
    await user.clear(title)
    await user.type(title, 'Lavar e estender{Enter}')

    await user.click(topCard())
    expect(topCard()).toHaveAccessibleName(/^Lavar e estender/)
    expect(topCard()).toHaveAccessibleDescription(/Repete Toda semana/)
    expect(topCard()).toHaveAccessibleDescription(/Adiada 2 dias/)

    await user.click(within(screen.getByTestId('undo-toast')).getByRole('button', { name: 'Desfazer' }))
    expect(topCard()).toHaveAccessibleName(/^Lavar a roupa/)
  })

  it('saving without changes closes the sheet and announces nothing', async () => {
    const { user } = renderApp()

    topCard().focus()
    await user.keyboard('e')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByTestId('undo-toast')).toBeNull()
  })
})
