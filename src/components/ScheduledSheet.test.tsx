import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createTask, type RecurringTask } from '../domain/index.ts'
import { renderWithI18n } from '../test/render.tsx'
import { formatDueDate } from '../ui/format.ts'
import { ptBR } from '../i18n/pt-BR.ts'
import { ScheduledSheet, type ScheduledSheetProps } from './ScheduledSheet.tsx'

const NOW = new Date(2026, 9, 5, 10, 0)

function recurring(id: string, title: string, date: string): RecurringTask {
  const task = createTask(
    { deckId: 'home', title, due: { date }, recurrence: { unit: 'week', every: 1, anchor: 'due' } },
    { id, now: NOW },
  )
  if (task.due === null || task.recurrence === null) throw new Error('expected a recurring task')
  return { ...task, due: task.due, recurrence: task.recurrence }
}

const TASKS = [recurring('a', 'Regar as plantas', '2026-10-06'), recurring('b', 'Lavar a roupa', '2026-10-09')]

function renderSheet(props: Partial<ScheduledSheetProps> = {}) {
  const handlers = { onCompleteNow: vi.fn(), onEdit: vi.fn(), onRemove: vi.fn(), onClose: vi.fn() }
  const result = renderWithI18n(
    <ScheduledSheet tasks={TASKS} deckNames={new Map([['home', 'Casa']])} {...handlers} {...props} />,
  )
  return { ...result, ...handlers }
}

describe('ScheduledSheet', () => {
  it('is a labelled dialog listing each card with its next date, rule and deck', () => {
    renderSheet()

    expect(screen.getByRole('dialog', { name: 'Agendadas' })).toHaveAttribute('aria-modal', 'true')
    const items = screen.getAllByTestId('scheduled-item')
    expect(items).toHaveLength(2)
    const first = items[0] as HTMLElement
    expect(within(first).getByRole('heading', { name: 'Regar as plantas' })).toBeInTheDocument()
    expect(first).toHaveTextContent(`Próxima: ${formatDueDate({ date: '2026-10-06' }, 'pt-BR', ptBR)}`)
    expect(first).toHaveTextContent('Toda semana, contando do prazo')
    expect(first).toHaveTextContent('Baralho: Casa')
  })

  it('offers complete now, edit and delete per card', async () => {
    const { user, onCompleteNow, onEdit, onRemove } = renderSheet()

    await user.click(screen.getByRole('button', { name: 'Concluir agora: Regar as plantas' }))
    await user.click(screen.getByRole('button', { name: 'Editar a tarefa Lavar a roupa' }))
    await user.click(screen.getByRole('button', { name: 'Apagar Lavar a roupa' }))

    expect(onCompleteNow).toHaveBeenCalledWith('a')
    expect(onEdit).toHaveBeenCalledWith('b')
    expect(onRemove).toHaveBeenCalledWith('b')
  })

  it('moves focus to the next item when one is deleted, and to the message when none is left', async () => {
    const { user, rerender } = renderSheet()
    const handlers = { onCompleteNow: vi.fn(), onEdit: vi.fn(), onClose: vi.fn() }

    await user.click(screen.getByRole('button', { name: 'Apagar Regar as plantas' }))
    rerender(<ScheduledSheet tasks={[TASKS[1] as RecurringTask]} deckNames={new Map()} onRemove={vi.fn()} {...handlers} />)
    expect(screen.getByRole('button', { name: 'Concluir agora: Lavar a roupa' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Apagar Lavar a roupa' }))
    rerender(<ScheduledSheet tasks={[]} deckNames={new Map()} onRemove={vi.fn()} {...handlers} />)
    expect(screen.getByText('Nenhuma carta agendada.')).toHaveFocus()
  })
})
