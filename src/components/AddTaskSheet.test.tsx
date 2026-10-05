import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithI18n } from '../test/render.tsx'
import { AddTaskSheet } from './AddTaskSheet.tsx'

function renderSheet() {
  const onCreate = vi.fn()
  const onClose = vi.fn()
  const result = renderWithI18n(
    <AddTaskSheet deckId="deck-1" createId={() => 'new-id'} onCreate={onCreate} onClose={onClose} />,
  )
  return { ...result, onCreate, onClose }
}

describe('AddTaskSheet', () => {
  it('is a labelled modal dialog that focuses the title field', () => {
    renderSheet()

    const dialog = screen.getByRole('dialog', { name: 'Nova tarefa' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText('Título')).toHaveFocus()
  })

  it('closes on Escape', async () => {
    const { user, onClose } = renderSheet()

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    const { user } = renderSheet()
    const submit = screen.getByRole('button', { name: 'Criar tarefa' })
    const close = screen.getByRole('button', { name: 'Fechar' })

    submit.focus()
    await user.tab()
    expect(close).toHaveFocus()

    await user.tab({ shift: true })
    expect(submit).toHaveFocus()
  })

  it('shows an accessible error and focuses the title when it is empty', async () => {
    const { user, onCreate } = renderSheet()

    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }))

    const title = screen.getByLabelText('Título')
    expect(title).toHaveAttribute('aria-invalid', 'true')
    expect(title).toHaveAccessibleDescription('Informe um título.')
    expect(title).toHaveFocus()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('rejects a title over 80 characters and a time without a date', async () => {
    const { user, onCreate } = renderSheet()

    await user.click(screen.getByLabelText('Título'))
    await user.paste('x'.repeat(81))
    await user.type(screen.getByLabelText(/Hora do prazo/), '10:30')
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }))

    expect(screen.getByLabelText('Título')).toHaveAccessibleDescription('Use no máximo 80 caracteres.')
    expect(screen.getByLabelText(/Hora do prazo/)).toHaveAccessibleDescription('Escolha uma data para usar um horário.')
    expect(screen.getByLabelText(/Data do prazo/)).toHaveAttribute('aria-invalid', 'false')
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('creates a task through the domain factory with the chosen fields', async () => {
    const { user, onCreate } = renderSheet()

    await user.type(screen.getByLabelText('Título'), 'Regar as plantas')
    await user.type(screen.getByLabelText(/Descrição/), 'As da varanda')
    await user.click(screen.getByRole('radio', { name: 'Alta' }))
    await user.type(screen.getByLabelText(/Data do prazo/), '2026-10-07')
    await user.type(screen.getByLabelText(/Hora do prazo/), '08:15')
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }))

    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
      id: 'new-id',
      deckId: 'deck-1',
      title: 'Regar as plantas',
      description: 'As da varanda',
      priority: 'high',
      due: { date: '2026-10-07', time: '08:15' },
      status: 'active',
    })
  })

  it('defaults to medium priority and no due date', async () => {
    const { user, onCreate } = renderSheet()

    expect(screen.getByRole('radio', { name: 'Média' })).toBeChecked()
    await user.type(screen.getByLabelText('Título'), 'Sem prazo{Enter}')

    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({ priority: 'medium', due: null })
  })
})
