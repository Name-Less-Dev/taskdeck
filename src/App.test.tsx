import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { createTask, type Task, type TaskInput } from './domain/index.ts'
import { renderWithI18n } from './test/render.tsx'

// Fixed local clock (5 Oct 2026, 10:00). Only Date is faked: real timers keep
// user-event and Motion working normally.
const NOW = new Date(2026, 9, 5, 10, 0)

function task(id: string, input: Omit<TaskInput, 'deckId'>, extra: Partial<Task> = {}): Task {
  return { ...createTask({ deckId: 'd', ...input }, { id, now: NOW }), ...extra }
}

const overdue = task('overdue', { title: 'Pagar a luz', due: { date: '2026-10-04' }, priority: 'high' })
const today = task('today', { title: 'Enviar relatório', due: { date: '2026-10-05' } })
const noDue = task('no-due', { title: 'Ler um livro', priority: 'low' })
const laundry = task('laundry', {
  title: 'Lavar a roupa',
  due: { date: '2026-10-03' },
  recurrence: { unit: 'week', every: 1, anchor: 'due' },
})

function renderApp(tasks: readonly Task[], locale: 'pt-BR' | 'en' = 'pt-BR') {
  let next = 0
  return renderWithI18n(
    <App
      initialTasks={tasks}
      createId={() => {
        next += 1
        return `created-${next}`
      }}
    />,
    locale,
  )
}

function topCard(): HTMLElement {
  return within(screen.getByTestId('top-card')).getByRole('button')
}

/** Titles in deck order, including the decorative cards underneath. */
function deckTitles(): string[] {
  const region = screen.getByRole('region', { name: 'Baralho de tarefas' })
  return within(region)
    .queryAllByRole('heading', { level: 2, hidden: true })
    .map((heading) => heading.textContent)
}

function liveRegion(): HTMLElement {
  return screen.getByRole('status')
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('App deck', () => {
  it('puts the most urgent task on top, whatever the input order', () => {
    renderApp([noDue, today, overdue])

    expect(topCard()).toHaveAccessibleName('Pagar a luz. Atrasada há 10 h. Prioridade alta.')
    expect(deckTitles()).toEqual(['Pagar a luz', 'Enviar relatório', 'Ler um livro'])
  })

  it('draws at most three cards and only the top one is interactive', () => {
    renderApp([overdue, today, noDue, laundry])

    expect(deckTitles()).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: /Prioridade/ })).toHaveLength(1)
  })

  it('flips the top card by click and by Enter / Space', async () => {
    const { user } = renderApp([overdue, today])

    await user.click(topCard())
    expect(topCard()).toHaveAttribute('aria-pressed', 'true')

    await user.keyboard('{Enter}')
    expect(topCard()).toHaveAttribute('aria-pressed', 'false')

    await user.keyboard(' ')
    expect(topCard()).toHaveAttribute('aria-pressed', 'true')
  })

  it('completes a one-off task with the button: it leaves the deck', async () => {
    const { user } = renderApp([overdue, today])

    await user.click(screen.getByRole('button', { name: 'Concluir' }))

    await waitFor(() => {
      expect(deckTitles()).toEqual(['Enviar relatório'])
    })
    expect(screen.getByTestId('undo-toast')).toHaveTextContent('Tarefa concluída')
    expect(liveRegion()).toHaveTextContent('Tarefa concluída: Pagar a luz. Desfazer disponível.')
  })

  it('completes a recurring task with ArrowRight: it stays and comes back further down', async () => {
    const { user } = renderApp([laundry, today, noDue])
    expect(deckTitles()).toEqual(['Lavar a roupa', 'Enviar relatório', 'Ler um livro'])

    topCard().focus()
    await user.keyboard('{ArrowRight}')

    // Next weekly occurrence after 3 Oct is 10 Oct: "in 5 days", below today's task.
    await waitFor(() => {
      expect(deckTitles()).toEqual(['Enviar relatório', 'Lavar a roupa', 'Ler um livro'])
    })
    expect(screen.getByText('Em 5 dias')).toBeInTheDocument()
  })

  it('postpones with ArrowLeft: the card goes to the bottom and shows "adiada 1 dia"', async () => {
    const { user } = renderApp([overdue, today, noDue])

    topCard().focus()
    await user.keyboard('{ArrowLeft}')

    await waitFor(() => {
      expect(deckTitles()).toEqual(['Enviar relatório', 'Ler um livro', 'Pagar a luz'])
    })
    expect(screen.getByText('adiada 1 dia')).toBeInTheDocument()
    expect(liveRegion()).toHaveTextContent('Tarefa adiada: Pagar a luz.')
  })

  it('deletes with the button and with the Delete key', async () => {
    const { user } = renderApp([overdue, today, noDue])

    await user.click(screen.getByRole('button', { name: 'Apagar' }))
    await waitFor(() => {
      expect(deckTitles()).toEqual(['Enviar relatório', 'Ler um livro'])
    })

    topCard().focus()
    await user.keyboard('{Delete}')
    await waitFor(() => {
      expect(deckTitles()).toEqual(['Ler um livro'])
    })
    expect(liveRegion()).toHaveTextContent('Tarefa apagada: Enviar relatório.')
  })

  it('returns focus to the new top card after an action', async () => {
    const { user } = renderApp([overdue, today])

    await user.click(screen.getByRole('button', { name: 'Concluir' }))

    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/Enviar relatório/)
    })
    expect(topCard()).toHaveFocus()
  })
})

describe('App undo and redo', () => {
  it('undoes with the header button and redoes it', async () => {
    const { user } = renderApp([overdue, today])
    const undo = screen.getByRole('button', { name: 'Desfazer' })
    const redo = screen.getByRole('button', { name: 'Refazer' })
    expect(undo).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Apagar' }))
    await waitFor(() => {
      expect(undo).toBeEnabled()
    })

    await user.click(undo)
    expect(deckTitles()).toEqual(['Pagar a luz', 'Enviar relatório'])
    expect(liveRegion()).toHaveTextContent('Ação desfeita.')
    expect(screen.queryByTestId('undo-toast')).toBeNull()

    await user.click(redo)
    expect(deckTitles()).toEqual(['Enviar relatório'])
    expect(liveRegion()).toHaveTextContent('Ação refeita.')
  })

  it('undoes with Ctrl+Z and redoes with Ctrl+Shift+Z and Ctrl+Y', async () => {
    const { user } = renderApp([overdue, today, noDue])

    topCard().focus()
    await user.keyboard('{ArrowRight}')
    await waitFor(() => {
      expect(deckTitles()).toEqual(['Enviar relatório', 'Ler um livro'])
    })

    await user.keyboard('{Control>}z{/Control}')
    expect(deckTitles()).toEqual(['Pagar a luz', 'Enviar relatório', 'Ler um livro'])

    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(deckTitles()).toEqual(['Enviar relatório', 'Ler um livro'])

    await user.keyboard('{Control>}z{/Control}')
    await user.keyboard('{Control>}y{/Control}')
    expect(deckTitles()).toEqual(['Enviar relatório', 'Ler um livro'])
  })

  it('undoes from the toast, restoring the postponed counter', async () => {
    const { user } = renderApp([overdue, today])

    await user.click(screen.getByRole('button', { name: 'Adiar' }))
    const toast = await screen.findByTestId('undo-toast')
    expect(screen.getByText('adiada 1 dia')).toBeInTheDocument()

    await user.click(within(toast).getByRole('button', { name: 'Desfazer' }))

    expect(deckTitles()).toEqual(['Pagar a luz', 'Enviar relatório'])
    expect(screen.queryByText(/adiada/)).toBeNull()
    expect(topCard()).toHaveFocus()
  })
})

describe('App empty state', () => {
  it('shows the empty state, disables the actions and announces it', async () => {
    const { user } = renderApp([today])

    await user.click(screen.getByRole('button', { name: 'Concluir' }))

    expect(await screen.findByRole('heading', { name: 'Tudo em dia!' })).toBeInTheDocument()
    expect(liveRegion()).toHaveTextContent(
      'Tarefa concluída: Enviar relatório. Desfazer disponível. Nenhuma tarefa no baralho.',
    )
    for (const name of ['Adiar', 'Apagar', 'Concluir']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    expect(screen.getByRole('region', { name: 'Baralho de tarefas' })).toHaveFocus()
  })

  it('starts empty without crashing', () => {
    renderApp([])

    expect(screen.getByRole('heading', { name: 'Tudo em dia!' })).toBeInTheDocument()
  })
})

describe('App task creation', () => {
  it('creates a task from the sheet, announces it and returns focus to the deck', async () => {
    const { user } = renderApp([noDue])

    await user.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    const dialog = screen.getByRole('dialog', { name: 'Nova tarefa' })
    await user.type(within(dialog).getByLabelText('Título'), 'Regar as plantas')
    await user.type(within(dialog).getByLabelText(/Data do prazo/), '2026-10-05')
    await user.click(within(dialog).getByRole('button', { name: 'Criar tarefa' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(deckTitles()).toEqual(['Regar as plantas', 'Ler um livro'])
    expect(liveRegion()).toHaveTextContent('Tarefa criada: Regar as plantas.')
    expect(topCard()).toHaveFocus()
  })

  it('makes the rest of the page inert while the sheet is open and restores focus on close', async () => {
    const { user, container } = renderApp([noDue])

    await user.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    expect(container.querySelector('[inert]')).not.toBeNull()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(topCard()).toHaveFocus()
  })
})

describe('App in English', () => {
  it('renders the same deck with English texts', () => {
    renderApp([overdue], 'en')

    expect(within(screen.getByTestId('top-card')).getByRole('button')).toHaveAccessibleName(
      'Pagar a luz. Overdue by 10 h. High priority.',
    )
    expect(screen.getByRole('button', { name: 'Complete' })).toBeInTheDocument()
  })
})
