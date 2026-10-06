import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { REMINDER_TOAST_MS } from './components/ReminderToast.tsx'
import { createTask, type Task, type TaskInput } from './domain/index.ts'
import { I18nProvider } from './i18n/index.tsx'
import { appProps } from './test/app.tsx'

const START = new Date(2026, 9, 5, 8, 0)

function task(id: string, input: Omit<TaskInput, 'deckId'>): Task {
  return createTask({ deckId: 'd', ...input }, { id, now: START })
}

function renderApp(tasks: readonly Task[]) {
  return render(
    <I18nProvider locale="pt-BR">
      <App {...appProps({ decks: [{ id: 'd', name: 'Geral' }], tasks })} />
    </I18nProvider>,
  )
}

function advanceMinutes(minutes: number) {
  act(() => {
    vi.advanceTimersByTime(minutes * 60_000)
  })
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

const reminder = () => screen.queryByTestId('reminder-toast')
const live = () => screen.getByRole('status')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(START)
})

afterEach(() => {
  Reflect.deleteProperty(document, 'visibilityState')
  vi.useRealTimers()
})

describe('in-app due reminders', () => {
  it('says nothing on load, even with an overdue task', () => {
    renderApp([task('late', { title: 'Atrasada', due: { date: '2026-10-01' } })])

    advanceMinutes(1)

    expect(reminder()).toBeNull()
  })

  it('shows and announces a reminder when a task becomes "soon", then when it becomes overdue', () => {
    renderApp([task('m', { title: 'Reunião', due: { date: '2026-10-05', time: '12:00' } })])

    advanceMinutes(90) // 09:30: within 3 h
    expect(reminder()).toHaveTextContent('Prazo chegando: Reunião (faltam 2 h 30 min)')
    expect(reminder()).toHaveAttribute('data-tone', 'warning')
    expect(live()).toHaveTextContent('Prazo chegando: Reunião (faltam 2 h 30 min)')

    advanceMinutes(150) // 12:00
    expect(reminder()).toHaveTextContent('Venceu: Reunião')
    expect(reminder()).toHaveAttribute('data-tone', 'danger')
  })

  it('groups simultaneous changes into one notice', () => {
    renderApp([
      task('a', { title: 'A', due: { date: '2026-10-05', time: '12:00' } }),
      task('b', { title: 'B', due: { date: '2026-10-05', time: '12:00' } }),
    ])

    advanceMinutes(90)

    expect(screen.getAllByTestId('reminder-toast')).toHaveLength(1)
    expect(reminder()).toHaveTextContent('2 tarefas mudaram de estado')
  })

  it('summarizes once when coming back to a hidden tab', () => {
    renderApp([
      task('a', { title: 'A', due: { date: '2026-10-05', time: '09:00' } }),
      task('b', { title: 'B', due: { date: '2026-10-05', time: '09:30' } }),
    ])

    setVisibility('hidden')
    advanceMinutes(120) // 10:00: both overdue while away
    expect(reminder()).toBeNull()

    setVisibility('visible')
    expect(reminder()).toHaveTextContent('2 tarefas venceram enquanto você estava fora')
    expect(live()).toHaveTextContent('2 tarefas venceram enquanto você estava fora')

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Dispensar aviso' }))
    })
    advanceMinutes(30)
    expect(reminder()).toBeNull()
  })

  it('never repeats the same notice for the same task and band', () => {
    renderApp([task('m', { title: 'Reunião', due: { date: '2026-10-05', time: '12:00' } })])

    advanceMinutes(90)
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(reminder()).toBeNull()

    advanceMinutes(60) // 10:30, still "soon"
    expect(reminder()).toBeNull()
  })

  it('goes away on its own after 10 seconds and never takes focus', () => {
    renderApp([task('m', { title: 'Reunião', due: { date: '2026-10-05', time: '12:00' } })])
    const focused = document.activeElement

    advanceMinutes(90)
    expect(reminder()).not.toBeNull()
    expect(document.activeElement).toBe(focused)

    act(() => {
      vi.advanceTimersByTime(REMINDER_TOAST_MS)
    })
    expect(reminder()).toBeNull()
  })
})
