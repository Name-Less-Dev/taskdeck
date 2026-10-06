import { act, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { createTask, type Task, type TaskInput } from './domain/index.ts'
import { I18nProvider, type Locale } from './i18n/index.tsx'
import { ptBR } from './i18n/pt-BR.ts'
import { appProps } from './test/app.tsx'
import { renderWithI18n, topCard } from './test/render.tsx'
import { formatDueDate } from './ui/format.ts'

const NOW = new Date(2026, 9, 5, 10, 0)
const DECKS = [{ id: 'd', name: 'Geral' }]

function task(id: string, input: Omit<TaskInput, 'deckId'>, extra: Partial<Task> = {}): Task {
  return { ...createTask({ deckId: 'd', ...input }, { id, now: NOW }), ...extra }
}

const WEEKLY = { unit: 'week', every: 1, anchor: 'due' } as const
const laundry = task('w', { title: 'Lavar a roupa', due: { date: '2026-10-05' }, recurrence: WEEKLY })
const plants = task('p', { title: 'Regar as plantas', due: { date: '2026-10-07' }, recurrence: WEEKLY })
const report = task('r', { title: 'Enviar relatório', due: { date: '2026-10-05' } })
// No due date: nothing changes for it at midnight (no reminder competing with the announcement).
const book = task('b', { title: 'Ler um livro' })

function renderApp(tasks: readonly Task[], locale: Locale = 'pt-BR') {
  return renderWithI18n(<App {...appProps({ decks: DECKS, tasks })} />, locale)
}

const progress = () => screen.getByTestId('daily-progress')
const liveRegion = () => screen.getByRole('status')

describe('recurring cards only on their day', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('hides a recurring card before its day and counts it under "Agendadas"', () => {
    renderApp([laundry, plants, report])

    expect(screen.queryByRole('button', { name: /^Regar as plantas/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Agendadas: 1 carta' })).toHaveTextContent('Agendadas (1)')
    expect(progress()).toHaveTextContent('0 de 2 hoje')
  })

  it('a completed recurring card leaves the deck and shows up in "Agendadas"; progress moves on', async () => {
    const { user } = renderApp([laundry, book])
    expect(topCard()).toHaveAccessibleName(/^Lavar a roupa\. Hoje/)

    await user.click(screen.getByRole('button', { name: 'Concluir' }))

    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/^Ler um livro/)
    })
    expect(progress()).toHaveTextContent('1 de 2 hoje')
    await user.click(screen.getByRole('button', { name: 'Agendadas: 1 carta' }))
    const sheet = screen.getByRole('dialog', { name: 'Agendadas' })
    expect(within(sheet).getByRole('heading', { name: 'Lavar a roupa' })).toBeInTheDocument()
    expect(sheet).toHaveTextContent(`Próxima: ${formatDueDate({ date: '2026-10-12' }, 'pt-BR', ptBR)}`)
  })

  it('a one-off task with a future due date stays on the deck', () => {
    renderApp([task('f', { title: 'Renovar passaporte', due: { date: '2026-12-01' } })])

    expect(topCard()).toHaveAccessibleName(/^Renovar passaporte/)
    expect(screen.queryByRole('button', { name: /^Agendadas/ })).toBeNull()
  })

  it('an overdue date-only recurring card stays, reading "Pendente há N dias" without the red band', () => {
    renderApp([task('late', { title: 'Varrer', due: { date: '2026-10-02' }, recurrence: WEEKLY })])

    expect(topCard()).toHaveAccessibleName(/^Varrer\. Pendente há 3 dias/)
    expect(topCard()).toHaveAttribute('data-band', 'pending')
  })
})

describe('daily empty states', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('"Tudo feito por hoje" after the last card of the day, with "Próximas (N)" opening the sheet', async () => {
    const { user } = renderApp([laundry, plants])

    await user.click(screen.getByRole('button', { name: 'Concluir' }))

    expect(await screen.findByRole('heading', { name: 'Tudo feito por hoje' })).toBeInTheDocument()
    expect(progress()).toHaveTextContent('1 de 1 hoje')
    await user.click(screen.getByRole('button', { name: 'Próximas (2)' }))
    expect(within(screen.getByRole('dialog', { name: 'Agendadas' })).getAllByTestId('scheduled-item')).toHaveLength(2)
  })

  it('"Nada para hoje" when nothing was completed today and only scheduled cards exist', () => {
    renderApp([plants])

    expect(screen.getByRole('heading', { name: 'Nada para hoje' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próximas (1)' })).toBeInTheDocument()
    expect(progress()).toHaveTextContent('0 de 0 hoje')
  })

  it('keeps the general empty state when there is nothing at all', () => {
    renderApp([])

    expect(screen.getByRole('heading', { name: 'Tudo em dia!' })).toBeInTheDocument()
  })

  it.each<[Locale, string, string]>([
    ['pt-BR', 'Tudo feito por hoje', '1 de 1 hoje'],
    ['en', 'All done for today', '1 of 1 today'],
  ])('says it in %s', async (locale, heading, count) => {
    const { user } = renderApp([laundry], locale)

    await user.click(screen.getByRole('button', { name: locale === 'en' ? 'Complete' : 'Concluir' }))

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expect(progress()).toHaveTextContent(count)
  })
})

describe('scheduled sheet actions', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function openScheduled(user: ReturnType<typeof renderApp>['user']) {
    await user.click(screen.getByRole('button', { name: /^Agendadas:/ }))
    return screen.getByRole('dialog', { name: 'Agendadas' })
  }

  it('"Concluir agora" completes early (next date moves on), announces it, and Undo restores it', async () => {
    const { user } = renderApp([plants, report])
    const sheet = await openScheduled(user)

    await user.click(within(sheet).getByRole('button', { name: 'Concluir agora: Regar as plantas' }))

    const next = formatDueDate({ date: '2026-10-14' }, 'pt-BR', ptBR)
    expect(liveRegion()).toHaveTextContent(`Regar as plantas: concluída. Volta em ${next}. Desfazer disponível.`)
    expect(sheet).toHaveTextContent(`Próxima: ${next}`)
    expect(progress()).toHaveTextContent('1 de 2 hoje')

    await user.click(within(screen.getByTestId('undo-toast')).getByRole('button', { name: 'Desfazer' }))
    expect(sheet).toHaveTextContent(`Próxima: ${formatDueDate({ date: '2026-10-07' }, 'pt-BR', ptBR)}`)
  })

  it('"Apagar" removes the card, announces it, and Undo brings it back', async () => {
    const { user } = renderApp([plants, report])
    const sheet = await openScheduled(user)

    await user.click(within(sheet).getByRole('button', { name: 'Apagar Regar as plantas' }))

    expect(within(sheet).getByText('Nenhuma carta agendada.')).toHaveFocus()
    expect(liveRegion()).toHaveTextContent('Tarefa apagada: Regar as plantas. Desfazer disponível.')
    await user.click(within(screen.getByTestId('undo-toast')).getByRole('button', { name: 'Desfazer' }))
    expect(within(sheet).getByRole('heading', { name: 'Regar as plantas' })).toBeInTheDocument()
  })

  it('"Editar" opens the form for that card', async () => {
    const { user } = renderApp([plants, report])
    const sheet = await openScheduled(user)

    await user.click(within(sheet).getByRole('button', { name: 'Editar a tarefa Regar as plantas' }))

    const form = screen.getByRole('dialog', { name: 'Editar tarefa' })
    expect(within(form).getByLabelText('Título')).toHaveValue('Regar as plantas')
  })
})

describe('day rollover', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date(2026, 9, 5, 23, 59, 40))
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

  const tomorrow = task('t', { title: 'Tomar remédio', due: { date: '2026-10-06' }, recurrence: WEEKLY })

  it('brings the card back at midnight and announces it once, never on load', () => {
    renderAt([tomorrow, book])
    expect(liveRegion()).toHaveTextContent('')
    expect(screen.queryByRole('button', { name: /^Tomar remédio/ })).toBeNull()

    act(() => {
      vi.advanceTimersByTime(30_000) // 00:00:10
    })

    expect(liveRegion()).toHaveTextContent('Novas cartas para hoje: 1.')
    expect(screen.getByRole('button', { name: 'Baralho: Todos os baralhos' })).toBeInTheDocument()
    expect(topCard()).toHaveAccessibleName(/^Tomar remédio/)
    expect(screen.queryByRole('button', { name: /^Agendadas/ })).toBeNull()

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(liveRegion()).toHaveTextContent('Novas cartas para hoje: 1.')
  })

  it('a dormant card never reminds, even when its time is near', () => {
    // Due tomorrow at 00:30: "soon" by the clock, but not on the deck yet.
    const early = task('e', { title: 'Plantão', due: { date: '2026-10-06', time: '00:30' }, recurrence: WEEKLY })
    renderAt([early, book])

    act(() => {
      vi.advanceTimersByTime(15_000)
    })

    expect(screen.queryByTestId('reminder-toast')).toBeNull()
  })
})
