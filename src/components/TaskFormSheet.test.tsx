import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createTask } from '../domain/index.ts'
import { renderWithI18n } from '../test/render.tsx'
import { TaskFormSheet, type TaskFormSheetProps } from './TaskFormSheet.tsx'

const DECKS = [
  { id: 'deck-1', name: 'Casa' },
  { id: 'deck-2', name: 'Trabalho' },
]

function renderSheet(props: Partial<TaskFormSheetProps> = {}) {
  const onCreate = vi.fn()
  const onUpdate = vi.fn()
  const onClose = vi.fn()
  const result = renderWithI18n(
    <TaskFormSheet
      decks={DECKS}
      defaultDeckId="deck-1"
      createId={() => 'new-id'}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onClose={onClose}
      {...props}
    />,
  )
  return { ...result, onCreate, onUpdate, onClose }
}

describe('TaskFormSheet: create', () => {
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

describe('TaskFormSheet: deck and tags', () => {
  it('preselects the default deck and lets the user pick another', async () => {
    const { user, onCreate } = renderSheet({ defaultDeckId: 'deck-2' })

    expect(screen.getByLabelText('Baralho')).toHaveValue('deck-2')
    await user.selectOptions(screen.getByLabelText('Baralho'), 'deck-1')
    await user.type(screen.getByLabelText('Título'), 'Mudar de baralho{Enter}')

    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({ deckId: 'deck-1' })
  })

  it('adds chips with Enter and comma, removes the last with Backspace and one with its button', async () => {
    const { user } = renderSheet()
    const input = screen.getByLabelText(/^Tags/)

    await user.type(input, ' Casa {Enter}')
    await user.type(input, 'trabalho,urgente,')
    expect(screen.getByRole('list', { name: 'Tags' })).toHaveTextContent('#casa#trabalho#urgente')

    await user.keyboard('{Backspace}')
    expect(screen.queryByText('#urgente')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Remover a tag casa' }))
    expect(screen.getByRole('list', { name: 'Tags' })).toHaveTextContent('#trabalho')
  })

  it('pressing Enter in the tag field does not submit the form', async () => {
    const { user, onCreate } = renderSheet()

    await user.type(screen.getByLabelText('Título'), 'Com tags')
    await user.type(screen.getByLabelText(/^Tags/), 'casa{Enter}')

    expect(onCreate).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows an accessible error for a tag that is too long', async () => {
    const { user } = renderSheet()
    const input = screen.getByLabelText(/^Tags/)

    await user.type(input, `${'x'.repeat(21)}{Enter}`)

    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(/Cada tag pode ter no máximo 20 caracteres\./)
    expect(screen.queryByRole('list', { name: 'Tags' })).toBeNull()
  })

  it('keeps text left in the tag field as a tag when saving', async () => {
    const { user, onCreate } = renderSheet()

    await user.type(screen.getByLabelText('Título'), 'Pendente')
    await user.type(screen.getByLabelText(/^Tags/), 'Mercado')
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }))

    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({ tags: ['mercado'] })
  })
})

describe('TaskFormSheet: edit', () => {
  const NOW = new Date(2026, 9, 5, 10, 0)
  const recurring = {
    ...createTask(
      {
        deckId: 'deck-2',
        title: 'Lavar a roupa',
        description: 'Brancas',
        tags: ['casa'],
        priority: 'high',
        due: { date: '2026-10-07', time: '09:00' },
        recurrence: { unit: 'week', every: 1, anchor: 'due' },
      },
      { id: 'r1', now: NOW },
    ),
    postponedDays: 2,
  }

  it('opens prefilled, titled "Editar tarefa", with the recurrence shown read-only', () => {
    renderSheet({ task: recurring })

    expect(screen.getByRole('dialog', { name: 'Editar tarefa' })).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('Lavar a roupa')
    expect(screen.getByLabelText(/Descrição/)).toHaveValue('Brancas')
    expect(screen.getByLabelText('Baralho')).toHaveValue('deck-2')
    expect(screen.getByRole('radio', { name: 'Alta' })).toBeChecked()
    expect(screen.getByLabelText(/Data do prazo/)).toHaveValue('2026-10-07')
    expect(screen.getByLabelText(/Hora do prazo/)).toHaveValue('09:00')
    expect(screen.getByRole('list', { name: 'Tags' })).toHaveTextContent('#casa')
    expect(screen.getByText(/Repete: Toda semana/)).toBeInTheDocument()
  })

  it('saves the edited fields as a patch', async () => {
    const { user, onUpdate, onCreate } = renderSheet({ task: recurring })

    await user.clear(screen.getByLabelText('Título'))
    await user.type(screen.getByLabelText('Título'), 'Lavar e passar')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(onCreate).not.toHaveBeenCalled()
    expect(onUpdate).toHaveBeenCalledWith('r1', expect.objectContaining({ title: 'Lavar e passar', tags: ['casa'] }))
  })

  it('refuses to remove the date of a recurring task', async () => {
    const { user, onUpdate } = renderSheet({ task: recurring })

    await user.clear(screen.getByLabelText(/Hora do prazo/))
    await user.clear(screen.getByLabelText(/Data do prazo/))
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(screen.getByLabelText(/Data do prazo/)).toHaveAccessibleDescription('Uma tarefa recorrente precisa de uma data.')
    expect(onUpdate).not.toHaveBeenCalled()
  })
})
