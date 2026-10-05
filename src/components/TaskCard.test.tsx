import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createTask, type Task } from '../domain/index.ts'
import { renderWithI18n } from '../test/render.tsx'
import { TaskCard, type TaskCardProps } from './TaskCard.tsx'

const NOW = new Date(2026, 9, 5, 10, 0)

function task(overrides: Partial<Task> = {}): Task {
  return {
    ...createTask(
      {
        deckId: 'd',
        title: 'Lavar a roupa',
        description: 'Brancas separadas.',
        priority: 'high',
        due: { date: '2026-10-05', time: '12:00' },
        recurrence: { unit: 'week', every: 1, anchor: 'due' },
      },
      { id: 't1', now: NOW },
    ),
    ...overrides,
  }
}

function renderCard(props: Partial<TaskCardProps> = {}, locale: 'pt-BR' | 'en' = 'pt-BR') {
  const handlers = { onFlip: vi.fn(), onSwipe: vi.fn(), onExited: vi.fn() }
  const result = renderWithI18n(
    <TaskCard task={task()} now={NOW} depth={0} flipped={false} exit={null} {...handlers} {...props} />,
    locale,
  )
  return { ...result, ...handlers }
}

describe('TaskCard', () => {
  it('exposes the top card as a focusable toggle button with title, due and priority in its name', () => {
    renderCard()

    const card = screen.getByRole('button', { name: 'Lavar a roupa. Faltam 2 h. Prioridade alta.' })
    expect(card).toHaveAttribute('tabindex', '0')
    expect(card).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the due badge, the priority as text and shape, and the recurrence on the front', () => {
    renderCard()

    expect(screen.getByText('Faltam 2 h')).toHaveAttribute('data-tone', 'warning')
    expect(screen.getByText(/Prioridade: Alta/)).toHaveAttribute('data-priority', 'high')
    expect(screen.getByText(/Prioridade: Alta/).querySelector('svg')).not.toBeNull()
    expect(screen.getAllByText('Toda semana')).not.toHaveLength(0)
  })

  it('shows the "postponed N days" badge only after at least one postponed day', () => {
    const { unmount } = renderCard({ task: task({ postponedDays: 0 }) })
    expect(screen.queryByText(/adiada \d/)).toBeNull()
    unmount()

    renderCard({ task: task({ postponedDays: 3 }) })
    expect(screen.getByText('adiada 3 dias')).toBeInTheDocument()
  })

  it('calls onFlip on a click without dragging', async () => {
    const { user, onFlip } = renderCard()

    await user.click(screen.getByRole('button'))

    expect(onFlip).toHaveBeenCalledTimes(1)
  })

  it('reveals the back to assistive technology when flipped', () => {
    renderCard({ flipped: true })

    const card = screen.getByRole('button')
    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(card).toHaveAccessibleDescription(/Brancas separadas\./)
    expect(card).toHaveAccessibleDescription(/Toda semana/)
  })

  it('formats the back in English', () => {
    renderCard({ flipped: true, task: task({ postponedDays: 1 }) }, 'en')

    const card = screen.getByRole('button', { name: 'Lavar a roupa. In 2 h. High priority.' })
    expect(card).toHaveAccessibleDescription(/Every week/)
    expect(card).toHaveAccessibleDescription(/1 day/)
  })

  it('renders cards underneath as hidden, inert and not focusable', () => {
    const { container } = renderCard({ depth: 1 })

    expect(screen.queryByRole('button')).toBeNull()
    const slot = container.querySelector('[aria-hidden="true"]')
    expect(slot).toHaveAttribute('inert')
  })

  it('plays the exit animation and then reports the action', async () => {
    const { onExited } = renderCard({ exit: 'complete' })

    await vi.waitFor(() => {
      expect(onExited).toHaveBeenCalledWith('complete')
    })
  })
})
