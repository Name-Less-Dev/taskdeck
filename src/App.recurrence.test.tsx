import { act, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { createTask, type Task, type TaskInput } from './domain/index.ts'
import { en } from './i18n/en.ts'
import { I18nProvider, type Locale } from './i18n/index.tsx'
import { ptBR } from './i18n/pt-BR.ts'
import { appProps } from './test/app.tsx'
import { renderWithI18n, topCard } from './test/render.tsx'
import { formatDueDate } from './ui/format.ts'

const NOW = new Date(2026, 9, 5, 10, 0)

function task(id: string, input: Omit<TaskInput, 'deckId'>): Task {
  return createTask({ deckId: 'd', ...input }, { id, now: NOW })
}

const DECKS = [{ id: 'd', name: 'Geral' }]

const weekly = task('w', {
  title: 'Lavar a roupa',
  due: { date: '2026-10-03' },
  recurrence: { unit: 'week', every: 1, anchor: 'due' },
})
const biweeklyFromCompletion = task('c', {
  title: 'Cortar o cabelo',
  due: { date: '2026-10-04' },
  recurrence: { unit: 'week', every: 2, anchor: 'completion' },
})

function renderApp(tasks: readonly Task[], locale: Locale = 'pt-BR') {
  return renderWithI18n(<App {...appProps({ decks: DECKS, tasks })} />, locale)
}

describe('recurrence on cards', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each<[Locale, string, RegExp]>([
    ['pt-BR', 'A cada 2 semanas', /A cada 2 semanas, contando da conclusão/],
    ['en', 'Every 2 weeks', /Every 2 weeks, counted from completion/],
  ])('shows a short badge on the front and the full rule on the back (%s)', async (locale, short, full) => {
    const { user } = renderApp([biweeklyFromCompletion], locale)

    expect(screen.getByTestId('recurrence-badge')).toHaveTextContent(short)
    await user.click(topCard())
    expect(topCard()).toHaveAccessibleDescription(full)
  })

  it('says a weekly due-anchored task counts from the due date', async () => {
    const { user } = renderApp([weekly])

    expect(screen.getByTestId('recurrence-badge')).toHaveTextContent('Toda semana')
    await user.click(topCard())
    expect(topCard()).toHaveAccessibleDescription(/Toda semana, contando do prazo/)
  })

  it('completing a recurring task says "Reagendada para <date>", keeps the card with its new date, and undo restores it', async () => {
    const { user } = renderApp([weekly, task('o', { title: 'Outra' })])

    await user.click(screen.getByRole('button', { name: 'Concluir' }))

    const nextDate = formatDueDate({ date: '2026-10-10' }, 'pt-BR', ptBR)
    expect(await screen.findByTestId('undo-toast')).toHaveTextContent(`Reagendada para ${nextDate}`)
    expect(screen.getByText(`Lavar a roupa: reagendada para ${nextDate}. Desfazer disponível.`)).toBeInTheDocument()
    // Still in the deck, with its next date (10 Oct: in 5 days).
    await waitFor(() => {
      expect(screen.getAllByText('Em 5 dias')).not.toHaveLength(0)
    })

    await user.click(within(screen.getByTestId('undo-toast')).getByRole('button', { name: 'Desfazer' }))
    // Back to the old due date (3 Oct, overdue since the end of that day: 34 h).
    expect(topCard()).toHaveAccessibleName(/^Lavar a roupa\. Atrasada há 1 dia/)
  })

  it('says "Rescheduled for" in English', async () => {
    const { user } = renderApp([weekly], 'en')

    await user.click(screen.getByRole('button', { name: 'Complete' }))

    const nextDate = formatDueDate({ date: '2026-10-10' }, 'en', en)
    expect(await screen.findByTestId('undo-toast')).toHaveTextContent(`Rescheduled for ${nextDate}`)
  })

  it('a one-off task still says "Tarefa concluída"', async () => {
    const { user } = renderApp([task('x', { title: 'Uma vez', due: { date: '2026-10-05' } })])

    await user.click(screen.getByRole('button', { name: 'Concluir' }))

    expect(await screen.findByTestId('undo-toast')).toHaveTextContent('Tarefa concluída')
  })

  it('creates a recurring task through the form and shows its badge', async () => {
    const { user } = renderApp([])
    await user.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    const dialog = screen.getByRole('dialog')

    await user.type(within(dialog).getByLabelText('Título'), 'Tomar remédio')
    await user.type(within(dialog).getByLabelText(/Data do prazo/), '2026-10-06')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Repetir esta tarefa' }))
    await user.selectOptions(within(dialog).getByLabelText('Unidade'), 'day')
    await user.click(within(dialog).getByRole('button', { name: 'Criar tarefa' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('recurrence-badge')).toHaveTextContent('Todo dia')
  })
})

describe('deadline escalation as time passes', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date(2026, 9, 5, 8, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('moves from today to soon (pulse band) to overdue, always with text and an icon', () => {
    const meeting = task('m', { title: 'Reunião', due: { date: '2026-10-05', time: '12:00' } })
    render(
      <I18nProvider locale="pt-BR">
        <App {...appProps({ decks: DECKS, tasks: [meeting] })} />
      </I18nProvider>,
    )
    const band = () => topCard().getAttribute('data-band')
    const badge = () => screen.getByText(/Hoje|Falta|Atrasada/)

    expect(band()).toBe('today')
    expect(badge()).toHaveTextContent('Hoje')

    act(() => {
      vi.advanceTimersByTime(90 * 60_000) // 09:30
    })
    expect(band()).toBe('soon')
    expect(badge()).toHaveTextContent('Faltam 2 h 30 min')
    expect(badge().closest('[data-tone]')).toHaveAttribute('data-tone', 'warning')

    act(() => {
      vi.advanceTimersByTime(150 * 60_000) // 12:00
    })
    expect(band()).toBe('overdue')
    expect(badge()).toHaveTextContent('Atrasada agora')
    expect(badge().closest('[data-tone]')).toHaveAttribute('data-tone', 'danger')
    expect(badge().querySelector('svg')).not.toBeNull()
  })
})
