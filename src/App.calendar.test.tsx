import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App, { type AppProps } from './App.tsx'
import { createTask, type AppData, type Task, type TaskInput } from './domain/index.ts'
import { createMemoryStorage, DEFAULT_META } from './storage/index.ts'
import { appProps } from './test/app.tsx'
import { renderWithI18n, topCard } from './test/render.tsx'

const NOW = new Date(2026, 9, 5, 10, 0)

function task(id: string, deckId: string, input: Omit<TaskInput, 'deckId'>): Task {
  return createTask({ deckId, ...input }, { id, now: NOW })
}

const data: AppData = {
  decks: [
    { id: 'home', name: 'Casa' },
    { id: 'work', name: 'Trabalho' },
  ],
  tasks: [
    task('a', 'home', { title: 'Pagar a luz', due: { date: '2026-10-05', time: '18:00' }, priority: 'high' }),
    task('b', 'work', { title: 'Relatório', due: { date: '2026-10-08' } }),
    task('c', 'home', { title: 'Sem prazo' }),
  ],
}

function renderApp(overrides: Partial<AppProps> = {}) {
  const download = vi.fn()
  const result = renderWithI18n(<App {...appProps(data, { download, ...overrides })} />)
  return { ...result, download }
}

async function downloaded(download: ReturnType<typeof vi.fn>, call = 0) {
  const [blob, name] = download.mock.calls[call] as [Blob, string]
  return { blob, name, text: await blob.text() }
}

const uids = (text: string) => [...text.matchAll(/^UID:(.+)$/gm)].map((match) => match[1]?.trim())

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('add one task to the calendar', () => {
  it('exports only the flipped card, as a dated text/calendar file, and keeps focus on the button', async () => {
    const { user, download } = renderApp()

    await user.click(topCard())
    const button = screen.getByRole('button', { name: 'Adicionar “Pagar a luz” ao calendário' })
    await user.click(button)

    const file = await downloaded(download)
    expect(file.name).toBe('taskdeck-2026-10-05.ics')
    expect(file.blob.type).toBe('text/calendar;charset=utf-8')
    expect(uids(file.text)).toEqual(['a@taskdeck'])
    expect(file.text).toContain('SUMMARY:Pagar a luz')
    expect(file.text).toContain('TRIGGER:-PT15M')
    expect(button).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Calendário exportado com 1 tarefa. Arquivo baixado. Abra-o para adicionar ao calendário.',
    )
    const notice = screen.getByTestId('undo-toast')
    expect(notice).toHaveTextContent('Arquivo baixado. Abra-o para adicionar ao calendário.')
    expect(within(notice).queryByRole('button', { name: 'Desfazer' })).toBeNull()
  })

  it('is not offered for a task without a due date', async () => {
    const { user } = renderWithI18n(
      <App {...appProps({ decks: data.decks, tasks: [task('c', 'home', { title: 'Sem prazo' })] })} />,
    )

    await user.click(topCard())

    expect(screen.queryByRole('button', { name: /ao calendário/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Editar/ })).toBeInTheDocument()
  })
})

describe('export from settings', () => {
  it('exports every active task with a due date, and only the active deck when asked', async () => {
    const { user, download } = renderApp({
      initialMeta: { ...DEFAULT_META, settings: { activeDeckId: 'home', language: 'auto', alarm: '15m', installHintDismissed: false } },
    })
    await user.click(screen.getByRole('button', { name: 'Configurações' }))
    const dialog = screen.getByRole('dialog', { name: 'Configurações' })

    expect(within(dialog).getByTestId('exportable-count')).toHaveTextContent('2 tarefas ativas com prazo')
    await user.click(within(dialog).getByRole('button', { name: 'Exportar tarefas com prazo (.ics)' }))
    expect(uids((await downloaded(download, 0)).text)).toEqual(['a@taskdeck', 'b@taskdeck'])
    expect(screen.getByTestId('undo-toast')).toHaveTextContent('Arquivo baixado. Abra-o para adicionar ao calendário.')
    expect(screen.getByRole('status')).toHaveTextContent('Calendário exportado com 2 tarefas. Arquivo baixado.')

    await user.click(within(dialog).getByRole('checkbox', { name: 'Só o baralho ativo (Casa)' }))
    expect(within(dialog).getByTestId('exportable-count')).toHaveTextContent('1 tarefa ativa com prazo')
    await user.click(within(dialog).getByRole('button', { name: 'Exportar tarefas com prazo (.ics)' }))
    expect(uids((await downloaded(download, 1)).text)).toEqual(['a@taskdeck'])
  })

  it('disables the export when nothing has a due date, and explains the limits', async () => {
    const { user } = renderWithI18n(<App {...appProps({ decks: data.decks, tasks: [task('c', 'home', { title: 'Sem prazo' })] })} />)
    await user.click(screen.getByRole('button', { name: 'Configurações' }))

    const button = screen.getByRole('button', { name: 'Exportar tarefas com prazo (.ics)' })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription(/Nenhuma tarefa ativa com prazo para exportar\..*vão só com a próxima data/)
  })

  it('uses the chosen alarm, persists it in meta, and starts from the saved one', async () => {
    const storage = createMemoryStorage({ createId: () => 'g', names: { general: 'Geral', recovered: 'Recuperadas' } })
    const { user, download, unmount } = renderApp({ storage })
    await user.click(screen.getByRole('button', { name: 'Configurações' }))

    const select = screen.getByLabelText('Alarme dos eventos')
    expect(select).toHaveValue('15m')
    await user.selectOptions(select, '1h')
    await user.click(screen.getByRole('button', { name: 'Exportar tarefas com prazo (.ics)' }))

    expect((await downloaded(download)).text).toContain('TRIGGER:-PT1H')
    await waitFor(() => {
      expect(storage.snapshot().meta).toMatchObject({ settings: { alarm: '1h' } })
    })
    unmount()

    const again = renderApp({ initialMeta: { ...DEFAULT_META, settings: { activeDeckId: null, language: 'auto', alarm: '1d', installHintDismissed: false } } })
    await again.user.click(screen.getByRole('button', { name: 'Configurações' }))
    expect(screen.getByLabelText('Alarme dos eventos')).toHaveValue('1d')
  })

  it('returns focus to the settings button when the sheet closes', async () => {
    const { user } = renderApp()
    const gear = screen.getByRole('button', { name: 'Configurações' })

    await user.click(gear)
    await user.keyboard('{Escape}')

    expect(gear).toHaveFocus()
  })
})
