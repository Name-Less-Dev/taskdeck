import { act, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { createTask, type Task, type TaskInput } from './domain/index.ts'
import { I18nProvider, type Locale } from './i18n/index.tsx'
import { appProps } from './test/app.tsx'
import { renderWithI18n, topCard } from './test/render.tsx'

const NOW = new Date(2026, 9, 5, 10, 0)
const DECKS = [{ id: 'd', name: 'Geral' }]

function task(id: string, input: Omit<TaskInput, 'deckId'>, extra: Partial<Task> = {}): Task {
  return { ...createTask({ deckId: 'd', ...input }, { id, now: NOW }), ...extra }
}

const bank = task('a', { title: 'Ligar para o banco', priority: 'high' })
const book = task('b', { title: 'Ler um livro' })

function renderApp(tasks: readonly Task[], locale: Locale = 'pt-BR') {
  return renderWithI18n(<App {...appProps({ decks: DECKS, tasks })} />, locale)
}

const liveRegion = () => screen.getByRole('status')
const progress = () => screen.getByTestId('daily-progress')

describe('Tomorrow (snooze) from the deck', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('the "Amanhã" button hides the card, announces it with undo, and lists it under "Para amanhã"', async () => {
    const { user } = renderApp([bank, book])
    expect(topCard()).toHaveAccessibleName(/^Ligar para o banco/)

    await user.click(screen.getByRole('button', { name: 'Amanhã' }))

    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/^Ler um livro/)
    })
    expect(liveRegion()).toHaveTextContent('Adiada para amanhã: Ligar para o banco. Desfazer disponível.')
    expect(screen.getByTestId('undo-toast')).toHaveTextContent('Adiada para amanhã')
    expect(progress()).toHaveTextContent('0 de 1 hoje')

    await user.click(screen.getByRole('button', { name: 'Agendadas: 1 carta' }))
    const sheet = screen.getByRole('dialog', { name: 'Agendadas' })
    expect(within(sheet).getByRole('heading', { name: 'Para amanhã' })).toBeInTheDocument()
    expect(within(sheet).getByTestId('snoozed-item')).toHaveTextContent('Ligar para o banco')
  })

  it('ArrowDown on the focused card does the same, and Undo brings it back', async () => {
    const { user } = renderApp([bank, book])

    topCard().focus()
    await user.keyboard('{ArrowDown}')
    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/^Ler um livro/)
    })

    await user.click(within(screen.getByTestId('undo-toast')).getByRole('button', { name: 'Desfazer' }))
    expect(topCard()).toHaveAccessibleName(/^Ligar para o banco/)
  })

  it('"Trazer para hoje" puts the card back on the deck, announced and undoable', async () => {
    const { user } = renderApp([task('s', { title: 'Ligar para o banco' }, { snoozedUntil: '2026-10-06' }), book])
    await user.click(screen.getByRole('button', { name: 'Agendadas: 1 carta' }))

    await user.click(screen.getByRole('button', { name: 'Trazer para hoje: Ligar para o banco' }))

    expect(liveRegion()).toHaveTextContent('Trazida para hoje: Ligar para o banco. Desfazer disponível.')
    expect(screen.getByText('Nenhuma carta agendada.')).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(progress()).toHaveTextContent('0 de 2 hoje')
  })

  it('says it in English', async () => {
    const { user } = renderApp([bank], 'en')

    await user.click(screen.getByRole('button', { name: 'Tomorrow' }))

    expect(await screen.findByRole('heading', { name: "That's it for today" })).toBeInTheDocument()
    expect(liveRegion()).toHaveTextContent('Moved to tomorrow: Ligar para o banco. Undo available.')
    expect(screen.getByText('1 card is waiting for tomorrow.')).toBeInTheDocument()
  })
})

describe('honest empty states', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('1) cards left for tomorrow: "Por hoje é só", no celebration, "Ver agendadas" opens the sheet', async () => {
    const { user } = renderApp([
      task('s1', { title: 'Um' }, { snoozedUntil: '2026-10-06' }),
      task('s2', { title: 'Dois' }, { snoozedUntil: '2026-10-06' }),
      task('done', { title: 'Feita' }, { status: 'done', completedAt: new Date(2026, 9, 5, 9).toISOString() }),
    ])

    const heading = screen.getByRole('heading', { name: 'Por hoje é só' })
    expect(screen.getByText('2 cartas ficaram para amanhã.')).toBeInTheDocument()
    expect(heading.closest('[data-celebrate]')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Tudo feito por hoje' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Ver agendadas' }))
    expect(screen.getAllByTestId('snoozed-item')).toHaveLength(2)
  })

  it('2) done today and nothing snoozed: "Tudo feito por hoje" with the celebration', async () => {
    const { user } = renderApp([book])

    await user.click(screen.getByRole('button', { name: 'Concluir' }))

    const heading = await screen.findByRole('heading', { name: 'Tudo feito por hoje' })
    expect(heading.closest('[data-celebrate]')).not.toBeNull()
  })

  it('3) nothing at all: "Nada para hoje"', () => {
    renderApp([])

    expect(screen.getByRole('heading', { name: 'Nada para hoje' })).toBeInTheDocument()
  })
})

describe('the "Later" label everywhere', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('names the left action "Mais tarde" on the button, the overlay, the toast, the announcement and the legend', async () => {
    const { user, container } = renderApp([bank, book])

    const bar = screen.getByRole('group', { name: 'Ações da carta' })
    expect(within(bar).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Mais tarde',
      'Amanhã',
      'Apagar',
      'Concluir',
    ])
    expect(container.querySelector('[data-action="postpone"][aria-hidden="true"]')).toHaveTextContent('Mais tarde')
    expect(container.querySelector('[data-action="snooze"][aria-hidden="true"]')).toHaveTextContent('Amanhã')
    expect(within(container.querySelector('details') as HTMLElement).getByText('Mais tarde')).toBeInTheDocument()

    await user.click(within(bar).getByRole('button', { name: 'Mais tarde' }))
    expect(liveRegion()).toHaveTextContent('Para mais tarde: Ligar para o banco. Desfazer disponível.')
    expect(screen.getByTestId('undo-toast')).toHaveTextContent('Para mais tarde')
    expect(screen.queryByText(/Adiar|Tarefa adiada/)).toBeNull()
  })
})

describe('snooze and time', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function renderAt(tasks: readonly Task[]) {
    return render(
      <I18nProvider locale="pt-BR">
        <App {...appProps({ decks: DECKS, tasks })} />
      </I18nProvider>,
    )
  }

  it('a snoozed card comes back at midnight and is announced once', () => {
    vi.setSystemTime(new Date(2026, 9, 5, 23, 59, 40))
    renderAt([task('s', { title: 'Ligar para o banco' }, { snoozedUntil: '2026-10-06' }), book])
    expect(screen.queryByRole('button', { name: /^Ligar para o banco/ })).toBeNull()

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(liveRegion()).toHaveTextContent('Novas cartas para hoje: 1.')
    expect(screen.queryByRole('button', { name: /^Agendadas/ })).toBeNull()
  })

  it('a snoozed card never reminds while it is away, even when its deadline passes', () => {
    vi.setSystemTime(new Date(2026, 9, 5, 17, 50))
    const meeting = task('m', { title: 'Reunião', due: { date: '2026-10-05', time: '18:00' } }, { snoozedUntil: '2026-10-06' })
    renderAt([meeting, book])

    act(() => {
      vi.advanceTimersByTime(15 * 60_000)
    })

    expect(screen.queryByTestId('reminder-toast')).toBeNull()
    // The due date itself never moved.
    expect(screen.queryByText(/Venceu: Reunião/)).toBeNull()
  })
})
