import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createTask, type Task } from '../domain/index.ts'
import { ptBR } from '../i18n/pt-BR.ts'
import { renderWithI18n } from '../test/render.tsx'
import { formatDueDate } from '../ui/format.ts'
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
    expect(screen.getByLabelText(/Hora do prazo/)).toHaveAccessibleDescription(/^Escolha uma data para usar um horário\./)
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
    await user.type(screen.getByLabelText('Título'), 'Sem prazo')
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }))

    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({ priority: 'medium', due: null })
  })
})

describe('TaskFormSheet: deck and tags', () => {
  it('preselects the default deck and lets the user pick another', async () => {
    const { user, onCreate } = renderSheet({ defaultDeckId: 'deck-2' })

    expect(screen.getByLabelText('Baralho')).toHaveValue('deck-2')
    await user.selectOptions(screen.getByLabelText('Baralho'), 'deck-1')
    await user.type(screen.getByLabelText('Título'), 'Mudar de baralho')
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }))

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

  it('opens prefilled, titled "Editar tarefa", with the repetition filled in', () => {
    renderSheet({ task: recurring })

    expect(screen.getByRole('dialog', { name: 'Editar tarefa' })).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('Lavar a roupa')
    expect(screen.getByLabelText(/Descrição/)).toHaveValue('Brancas')
    expect(screen.getByLabelText('Baralho')).toHaveValue('deck-2')
    expect(screen.getByRole('radio', { name: 'Alta' })).toBeChecked()
    expect(screen.getByLabelText(/Data do prazo/)).toHaveValue('2026-10-07')
    expect(screen.getByLabelText(/Hora do prazo/)).toHaveValue('09:00')
    expect(screen.getByRole('list', { name: 'Tags' })).toHaveTextContent('#casa')
    expect(screen.getByRole('checkbox', { name: 'Repetir esta tarefa' })).toBeChecked()
    expect(screen.getByLabelText('A cada')).toHaveValue(1)
    expect(screen.getByLabelText('Unidade')).toHaveValue('week')
    expect(screen.getByRole('radio', { name: /do prazo/ })).toBeChecked()
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

describe('TaskFormSheet: Enter key', () => {
  it('declares what the virtual keyboard key does on each field', () => {
    renderSheet()

    expect(screen.getByLabelText('Título')).toHaveAttribute('enterkeyhint', 'next')
    expect(screen.getByLabelText(/Descrição/)).toHaveAttribute('enterkeyhint', 'enter')
    expect(screen.getByLabelText(/^Tags/)).toHaveAttribute('enterkeyhint', 'next')
    expect(screen.getByLabelText(/Data do prazo/)).toHaveAttribute('enterkeyhint', 'next')
    expect(screen.getByLabelText(/Hora do prazo/)).toHaveAttribute('enterkeyhint', 'done')
  })

  it('Enter in the title moves focus to the description and does not submit', async () => {
    const { user, onCreate } = renderSheet()

    await user.type(screen.getByLabelText('Título'), 'Comprar pão{Enter}')

    expect(screen.getByLabelText(/Descrição/)).toHaveFocus()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('Enter keeps moving through the single-line fields in order', async () => {
    const { user, onCreate } = renderSheet()

    await user.click(screen.getByLabelText(/^Tags/))
    await user.keyboard('{Enter}')
    expect(screen.getByRole('radio', { name: 'Média' })).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(screen.getByLabelText(/Data do prazo/)).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(screen.getByLabelText(/Hora do prazo/)).toHaveFocus()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('Enter in the last field submits', async () => {
    const { user, onCreate } = renderSheet()

    await user.type(screen.getByLabelText('Título'), 'Último campo')
    await user.type(screen.getByLabelText(/Hora do prazo/), '{Enter}')

    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({ title: 'Último campo' })
  })

  it('Enter in the tag field makes a chip when there is text, and moves on when it is empty', async () => {
    const { user, onCreate } = renderSheet()
    const tags = screen.getByLabelText(/^Tags/)

    await user.type(tags, 'casa{Enter}')
    expect(screen.getByRole('list', { name: 'Tags' })).toHaveTextContent('#casa')
    expect(tags).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(screen.getByRole('radio', { name: 'Média' })).toHaveFocus()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('Enter in the description inserts a new line; Ctrl+Enter submits', async () => {
    const { user, onCreate } = renderSheet()
    await user.type(screen.getByLabelText('Título'), 'Com descrição')
    const description = screen.getByLabelText(/Descrição/)

    await user.type(description, 'linha 1{Enter}linha 2')
    expect(description).toHaveValue('linha 1\nlinha 2')
    expect(onCreate).not.toHaveBeenCalled()

    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({ description: 'linha 1\nlinha 2' })
  })

  it('Ctrl+Enter in the title submits too, and validation still focuses the first invalid field', async () => {
    const { user, onCreate } = renderSheet()

    await user.click(screen.getByLabelText(/Descrição/))
    await user.keyboard('{Control>}{Enter}{/Control}')

    expect(onCreate).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Título')).toHaveFocus()
    expect(screen.getByLabelText('Título')).toHaveAccessibleDescription('Informe um título.')
  })

  it('ignores Enter while text is being composed (IME)', () => {
    const { onCreate } = renderSheet()
    const title = screen.getByLabelText('Título')
    title.focus()

    fireEvent.keyDown(title, { key: 'Enter', isComposing: true })
    fireEvent.keyDown(title, { key: 'Enter', keyCode: 229 })

    expect(title).toHaveFocus()
    expect(onCreate).not.toHaveBeenCalled()
  })
})

describe('TaskFormSheet: repetition', () => {
  const weekly = () =>
    createTask(
      {
        deckId: 'deck-1',
        title: 'Lavar a roupa',
        due: { date: '2026-10-07' },
        recurrence: { unit: 'week', every: 1, anchor: 'due' },
      },
      { id: 'w', now: new Date(2026, 9, 5, 10, 0) },
    )

  it('is off by default and shows its fields when turned on, with a hint for each anchor', async () => {
    const { user } = renderSheet()
    const toggle = screen.getByRole('checkbox', { name: 'Repetir esta tarefa' })
    expect(toggle).not.toBeChecked()
    expect(screen.queryByLabelText('A cada')).toBeNull()

    await user.click(toggle)

    expect(screen.getByLabelText('A cada')).toHaveValue(1)
    expect(screen.getByLabelText('Unidade')).toHaveValue('week')
    expect(screen.getByRole('radio', { name: /do prazo/ })).toHaveAccessibleDescription(/Calendário fixo/)
    expect(screen.getByRole('radio', { name: /da conclusão/ })).toHaveAccessibleDescription(/Recomeça ao concluir/)
  })

  it('creates a recurring task', async () => {
    const { user, onCreate } = renderSheet()

    await user.type(screen.getByLabelText('Título'), 'Regar as plantas')
    await user.type(screen.getByLabelText(/Data do prazo/), '2026-10-07')
    await user.click(screen.getByRole('checkbox', { name: 'Repetir esta tarefa' }))
    await user.clear(screen.getByLabelText('A cada'))
    await user.type(screen.getByLabelText('A cada'), '3')
    await user.selectOptions(screen.getByLabelText('Unidade'), 'day')
    await user.click(screen.getByRole('radio', { name: /da conclusão/ }))
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }))

    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
      due: { date: '2026-10-07' },
      recurrence: { unit: 'day', every: 3, anchor: 'completion' },
    })
  })

  it('names the units with the right plural', async () => {
    const { user } = renderSheet()
    await user.click(screen.getByRole('checkbox', { name: 'Repetir esta tarefa' }))
    const options = () => [...screen.getByLabelText('Unidade').querySelectorAll('option')].map((option) => option.textContent)

    expect(options()).toEqual(['dia', 'semana', 'mês'])
    await user.clear(screen.getByLabelText('A cada'))
    await user.type(screen.getByLabelText('A cada'), '2')
    expect(options()).toEqual(['dias', 'semanas', 'meses'])
  })

  it('requires a due date: accessible error on the date field, which gets focus', async () => {
    const { user, onCreate } = renderSheet()

    await user.type(screen.getByLabelText('Título'), 'Sem data')
    await user.click(screen.getByRole('checkbox', { name: 'Repetir esta tarefa' }))
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }))

    const date = screen.getByLabelText(/Data do prazo/)
    expect(date).toHaveAttribute('aria-invalid', 'true')
    expect(date).toHaveAccessibleDescription('Uma tarefa recorrente precisa de uma data.')
    expect(date).toHaveFocus()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it.each(['0', '1.5', ''])('rejects the interval "%s" with an accessible error', async (every) => {
    const { user, onCreate } = renderSheet()

    await user.type(screen.getByLabelText('Título'), 'Intervalo')
    await user.type(screen.getByLabelText(/Data do prazo/), '2026-10-07')
    await user.click(screen.getByRole('checkbox', { name: 'Repetir esta tarefa' }))
    await user.clear(screen.getByLabelText('A cada'))
    if (every !== '') await user.type(screen.getByLabelText('A cada'), every)
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }))

    expect(screen.getByLabelText('A cada')).toHaveAccessibleDescription('Use um número inteiro a partir de 1.')
    expect(screen.getByLabelText('A cada')).toHaveFocus()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('edits the repetition of a recurring task', async () => {
    const { user, onUpdate } = renderSheet({ task: weekly() })

    await user.clear(screen.getByLabelText('A cada'))
    await user.type(screen.getByLabelText('A cada'), '2')
    await user.click(screen.getByRole('radio', { name: /da conclusão/ }))
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(onUpdate).toHaveBeenCalledWith(
      'w',
      expect.objectContaining({ recurrence: { unit: 'week', every: 2, anchor: 'completion' } }),
    )
  })

  it('removes the repetition (and may remove the due date with it)', async () => {
    const { user, onUpdate } = renderSheet({ task: weekly() })

    await user.click(screen.getByRole('checkbox', { name: 'Repetir esta tarefa' }))
    await user.clear(screen.getByLabelText(/Data do prazo/))
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(onUpdate).toHaveBeenCalledWith('w', expect.objectContaining({ recurrence: null, due: null }))
  })

  it('keeps the Enter flow: time moves on to the toggle when repeating, and the anchor submits', async () => {
    const { user, onCreate } = renderSheet()
    await user.type(screen.getByLabelText('Título'), 'Enter')
    await user.type(screen.getByLabelText(/Data do prazo/), '2026-10-07')
    await user.click(screen.getByRole('checkbox', { name: 'Repetir esta tarefa' }))

    expect(screen.getByLabelText(/Hora do prazo/)).toHaveAttribute('enterkeyhint', 'next')
    await user.type(screen.getByLabelText(/Hora do prazo/), '{Enter}')
    expect(screen.getByRole('checkbox', { name: 'Repetir esta tarefa' })).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(screen.getByLabelText('A cada')).toHaveFocus()
    expect(onCreate).not.toHaveBeenCalled()

    await user.click(screen.getByRole('radio', { name: /do prazo/ }))
    await user.keyboard('{Enter}')
    expect(onCreate).toHaveBeenCalledTimes(1)
  })
})

describe('TaskFormSheet: time field', () => {
  const timeField = () => screen.getByLabelText(/Hora do prazo/)

  it('is a 24 h text field with a numeric keyboard, a description and no autocomplete', () => {
    renderSheet()

    expect(timeField()).toHaveAttribute('type', 'text')
    expect(timeField()).toHaveAttribute('inputmode', 'numeric')
    expect(timeField()).toHaveAttribute('autocomplete', 'off')
    expect(timeField()).toHaveAttribute('maxlength', '5')
    expect(timeField()).toHaveAccessibleDescription('Formato 24 h, como 09:30. Deixe vazio para o dia todo.')
  })

  it('masks "0930" to "09:30" and keeps only digits', async () => {
    const { user } = renderSheet()

    await user.type(timeField(), '0930')
    expect(timeField()).toHaveValue('09:30')

    await user.clear(timeField())
    await user.type(timeField(), '1a8b45')
    expect(timeField()).toHaveValue('18:45')
  })

  it('lets Backspace go back over the colon', async () => {
    const { user } = renderSheet()

    await user.type(timeField(), '093')
    expect(timeField()).toHaveValue('09:3')
    await user.keyboard('{Backspace}')
    expect(timeField()).toHaveValue('09:')
    await user.keyboard('{Backspace}')
    expect(timeField()).toHaveValue('09')
    await user.keyboard('{Backspace}')
    expect(timeField()).toHaveValue('0')
  })

  it('completes "9:30" to "09:30" when leaving the field', async () => {
    const { user } = renderSheet()

    await user.type(timeField(), '9:30')
    expect(timeField()).toHaveValue('9:30')
    await user.tab()

    expect(timeField()).toHaveValue('09:30')
    expect(timeField()).toHaveAttribute('aria-invalid', 'false')
  })

  it('rejects "2460" with an accessible error, and focuses the field on submit', async () => {
    const { user, onCreate } = renderSheet()
    await user.type(screen.getByLabelText('Título'), 'Hora errada')
    await user.type(screen.getByLabelText(/Data do prazo/), '2026-10-07')

    await user.type(timeField(), '2460')
    await user.tab()
    expect(timeField()).toHaveValue('24:60')
    expect(timeField()).toHaveAttribute('aria-invalid', 'true')
    expect(timeField()).toHaveAccessibleDescription(/^Informe uma hora válida \(HH:mm\)\./)

    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }))
    expect(timeField()).toHaveFocus()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('fills the field from the shortcuts, which do not submit', async () => {
    const { user, onCreate } = renderSheet()
    const shortcuts = screen.getByRole('group', { name: 'Horários rápidos' })
    expect(
      [...shortcuts.querySelectorAll('button')].map((button) => [button.textContent, button.type]),
    ).toEqual([
      ['09:00', 'button'],
      ['12:00', 'button'],
      ['18:00', 'button'],
    ])

    await user.click(screen.getByRole('button', { name: '18:00' }))
    expect(timeField()).toHaveValue('18:00')
    await user.click(screen.getByRole('button', { name: '09:00' }))
    expect(timeField()).toHaveValue('09:00')
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('accepts an empty time: the due date is the whole day', async () => {
    const { user, onCreate } = renderSheet()
    await user.type(screen.getByLabelText('Título'), 'Dia todo')
    await user.type(screen.getByLabelText(/Data do prazo/), '2026-10-07')
    await user.type(timeField(), '12')
    await user.clear(timeField())

    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }))

    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({ due: { date: '2026-10-07' } })
    const [created] = onCreate.mock.calls[0] as [Task]
    expect(created.due).not.toHaveProperty('time')
  })

  it('Enter moves from the date to the time field (not to a shortcut) without submitting', async () => {
    const { user, onCreate } = renderSheet()
    await user.type(screen.getByLabelText('Título'), 'Enter{Enter}')
    expect(screen.getByLabelText(/Descrição/)).toHaveFocus()

    await user.type(screen.getByLabelText(/Data do prazo/), '2026-10-07{Enter}')
    expect(timeField()).toHaveFocus()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('submits from the time field with Enter (no repetition), completing "9:30" first', async () => {
    const { user, onCreate } = renderSheet()
    await user.type(screen.getByLabelText('Título'), 'Reunião')
    await user.type(screen.getByLabelText(/Data do prazo/), '2026-10-07')

    expect(timeField()).toHaveAttribute('enterkeyhint', 'done')
    await user.type(timeField(), '9:30{Enter}')

    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({ due: { date: '2026-10-07', time: '09:30' } })
  })
})

describe('TaskFormSheet: days of the week', () => {
  async function weeklyForm() {
    const result = renderSheet()
    await result.user.type(screen.getByLabelText('Título'), 'Academia')
    await result.user.type(screen.getByLabelText(/Data do prazo/), '2026-10-06')
    await result.user.click(screen.getByRole('checkbox', { name: 'Repetir esta tarefa' }))
    return result
  }

  const day = (name: string) => screen.getByRole('button', { name })

  it('shows 7 toggles with a short visible name and the full accessible name, only for every 1 week', async () => {
    const { user } = await weeklyForm()

    const group = screen.getByRole('group', { name: 'Dias da semana' })
    const toggles = within(group).getAllByRole('button', { pressed: false })
    expect(toggles.map((button) => button.getAttribute('aria-label'))).toEqual([
      'domingo',
      'segunda-feira',
      'terça-feira',
      'quarta-feira',
      'quinta-feira',
      'sexta-feira',
      'sábado',
    ])
    expect(day('segunda-feira')).toHaveTextContent('seg.')

    await user.selectOptions(screen.getByLabelText('Unidade'), 'day')
    expect(screen.queryByRole('group', { name: 'Dias da semana' })).toBeNull()
    await user.selectOptions(screen.getByLabelText('Unidade'), 'week')
    await user.clear(screen.getByLabelText('A cada'))
    await user.type(screen.getByLabelText('A cada'), '2')
    expect(screen.queryByRole('group', { name: 'Dias da semana' })).toBeNull()
  })

  it('creates a Mon/Wed/Fri task: toggles, "Primeira vez", and the due date moved to Wednesday', async () => {
    const { user, onCreate } = await weeklyForm()

    for (const name of ['segunda-feira', 'quarta-feira', 'sexta-feira']) await user.click(day(name))

    expect(day('quarta-feira')).toHaveAttribute('aria-pressed', 'true')
    expect(day('terça-feira')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('first-time')).toHaveTextContent(
      `Primeira vez: ${formatDueDate({ date: '2026-10-07' }, 'pt-BR', ptBR)}`,
    )
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }))

    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
      due: { date: '2026-10-07' },
      recurrence: { unit: 'week', every: 1, anchor: 'due', weekdays: [1, 3, 5] },
    })
  })

  it('offers "Dias úteis" and "Fins de semana" shortcuts, and toggling again removes a day', async () => {
    const { user } = await weeklyForm()

    await user.click(screen.getByRole('button', { name: 'Dias úteis' }))
    expect(screen.getAllByRole('button', { pressed: true }).map((b) => b.getAttribute('aria-label'))).toEqual([
      'segunda-feira',
      'terça-feira',
      'quarta-feira',
      'quinta-feira',
      'sexta-feira',
    ])
    await user.click(day('sexta-feira'))
    expect(day('sexta-feira')).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'Fins de semana' }))
    expect(screen.getAllByRole('button', { pressed: true }).map((b) => b.getAttribute('aria-label'))).toEqual([
      'domingo',
      'sábado',
    ])
  })

  it('with days chosen, "da conclusão" is disabled and explained', async () => {
    const { user } = await weeklyForm()
    await user.click(screen.getByRole('radio', { name: /da conclusão/ }))

    await user.click(day('segunda-feira'))

    const completion = screen.getByRole('radio', { name: /da conclusão/ })
    expect(completion).toBeDisabled()
    expect(completion).toHaveAccessibleDescription(/a repetição segue o calendário e conta do prazo/)
    expect(screen.getByRole('radio', { name: /do prazo/ })).toBeChecked()
  })

  it('changing the unit or the interval clears the days', async () => {
    const { user } = await weeklyForm()
    await user.click(day('segunda-feira'))

    await user.selectOptions(screen.getByLabelText('Unidade'), 'month')
    await user.selectOptions(screen.getByLabelText('Unidade'), 'week')
    expect(day('segunda-feira')).toHaveAttribute('aria-pressed', 'false')

    await user.click(day('terça-feira'))
    await user.clear(screen.getByLabelText('A cada'))
    await user.type(screen.getByLabelText('A cada'), '1')
    expect(day('terça-feira')).toHaveAttribute('aria-pressed', 'false')
  })

  it('loads the days when editing, and saves the change', async () => {
    const task = createTask(
      {
        deckId: 'deck-1',
        title: 'Academia',
        due: { date: '2026-10-05' },
        recurrence: { unit: 'week', every: 1, anchor: 'due', weekdays: [1, 3, 5] },
      },
      { id: 'g', now: new Date(2026, 9, 5, 10, 0) },
    )
    const { user, onUpdate } = renderSheet({ task })

    expect(day('quarta-feira')).toHaveAttribute('aria-pressed', 'true')
    await user.click(day('quarta-feira'))
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(onUpdate).toHaveBeenCalledWith(
      'g',
      expect.objectContaining({ recurrence: { unit: 'week', every: 1, anchor: 'due', weekdays: [1, 5] } }),
    )
  })

  it('keeps the Enter flow: Enter skips the day toggles and the anchor submits', async () => {
    const { user, onCreate } = await weeklyForm()
    await user.click(day('segunda-feira'))

    screen.getByLabelText('A cada').focus()
    await user.keyboard('{Enter}')
    expect(screen.getByLabelText('Unidade')).toHaveFocus()

    await user.click(screen.getByRole('radio', { name: /do prazo/ }))
    await user.keyboard('{Enter}')
    expect(onCreate).toHaveBeenCalledTimes(1)
  })
})
