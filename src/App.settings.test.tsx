import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App, { type AppProps } from './App.tsx'
import { createTask, type AppData } from './domain/index.ts'
import { parseBackup, serializeBackup } from './storage/index.ts'
import { appProps, fakePersistence } from './test/app.tsx'
import { renderWithI18n, topCard } from './test/render.tsx'

const NOW = new Date(2026, 9, 5, 10, 0)

const data: AppData = {
  decks: [{ id: 'home', name: 'Casa' }],
  tasks: [createTask({ deckId: 'home', title: 'Lavar a louça' }, { id: 'a', now: NOW })],
}

const imported: AppData = {
  decks: [
    { id: 'x', name: 'Importado' },
    { id: 'y', name: 'Outro' },
  ],
  tasks: [
    createTask({ deckId: 'x', title: 'Tarefa importada' }, { id: 'i1', now: NOW }),
    createTask({ deckId: 'y', title: 'Mais uma' }, { id: 'i2', now: NOW }),
  ],
}

function renderApp(overrides: Partial<AppProps> = {}) {
  const download = vi.fn()
  const result = renderWithI18n(<App {...appProps(data, { download, ...overrides })} />)
  return { ...result, download }
}

async function openSettings(user: ReturnType<typeof renderApp>['user']) {
  await user.click(screen.getByRole('button', { name: 'Configurações' }))
  return screen.getByRole('dialog', { name: 'Configurações' })
}

function backupFile(text: string, name = 'taskdeck-backup.json'): File {
  return new File([text], name, { type: 'application/json' })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('settings: language', () => {
  it('shows the current choice and reports a new one', async () => {
    const onLanguageChange = vi.fn()
    const { user } = renderApp({ language: 'pt-BR', onLanguageChange })
    const dialog = await openSettings(user)

    expect(within(dialog).getByRole('radio', { name: 'Português' })).toBeChecked()
    await user.click(within(dialog).getByRole('radio', { name: 'English' }))

    expect(onLanguageChange).toHaveBeenCalledWith('en')
  })

  it('explains when ?lang= in the address wins', async () => {
    const { user } = renderApp({ languageForcedByUrl: true })

    expect(await openSettings(user)).toHaveTextContent('O endereço (?lang=) está definindo o idioma agora')
  })
})

describe('settings: storage status', () => {
  it.each([
    [{ supported: true, persisted: true }, 'sim'],
    [{ supported: true, persisted: false }, 'não'],
    [{ supported: false, persisted: false }, 'indisponível'],
  ])('shows persistent storage %o as "%s"', async (state, expected) => {
    const { user } = renderApp({ persistence: { get: () => Promise.resolve(state), request: () => Promise.resolve(state) } })

    await openSettings(user)

    await waitFor(() => {
      expect(screen.getByTestId('persistent-status')).toHaveTextContent(expected)
    })
  })

  it('asks for persistent storage only after the first user action', async () => {
    const persistence = fakePersistence()
    const { user } = renderApp({ persistence })
    expect(persistence.request).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Adiar' }))

    await waitFor(() => {
      expect(persistence.request).toHaveBeenCalledTimes(1)
    })
  })

  it('never asks for persistent storage in memory mode, and says data is not saved', async () => {
    const persistence = fakePersistence()
    const { user } = renderApp({ persistence, storageMode: 'memory' })

    await user.click(screen.getByRole('button', { name: 'Adiar' }))
    const dialog = await openSettings(user)

    expect(persistence.request).not.toHaveBeenCalled()
    expect(dialog).toHaveTextContent('Este navegador não está salvando seus dados.')
  })

  it('shows "nunca" without a backup, and the quarantine count when there is one', async () => {
    const { user } = renderApp({ quarantineTotal: 2 })

    const dialog = await openSettings(user)

    expect(screen.getByTestId('last-backup')).toHaveTextContent('nunca')
    expect(dialog).toHaveTextContent('2 registros inválidos foram guardados em quarentena')
  })
})

describe('settings: export', () => {
  it('downloads a dated JSON backup that parses back to the same data, and records the date', async () => {
    const { user, download } = renderApp()
    await openSettings(user)

    await user.click(screen.getByRole('button', { name: 'Exportar backup (.json)' }))

    expect(download).toHaveBeenCalledWith(expect.any(Blob), 'taskdeck-backup-2026-10-05.json')
    const blob = download.mock.calls[0]?.[0] as Blob
    expect(blob.type).toBe('application/json')
    const parsed = parseBackup(await blob.text(), { createId: () => 'x', names: { general: 'G', recovered: 'R' } })
    expect(parsed).toEqual({ ok: true, data, warnings: [] })
    expect(screen.getByTestId('last-backup')).not.toHaveTextContent('nunca')
    expect(screen.getByText('Backup exportado.')).toBeInTheDocument()
  })
})

describe('settings: import', () => {
  it('shows a summary and the warning, replaces the data after confirmation, and can be undone', async () => {
    const { user } = renderApp()
    const dialog = await openSettings(user)

    await user.upload(within(dialog).getByLabelText('Importar backup (.json)'), backupFile(serializeBackup(imported, { now: NOW })))

    const review = await within(dialog).findByRole('group', { name: '2 baralhos, 2 tarefas' })
    expect(review).toHaveTextContent('Isso substitui os seus dados atuais. Dá para desfazer nesta sessão.')
    expect(within(review).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await user.click(within(review).getByRole('button', { name: 'Substituir meus dados' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(topCard()).toHaveAccessibleName(/^Tarefa importada/)
    expect(screen.getByText('Dados importados: 2 baralhos, 2 tarefas. Desfazer disponível.')).toBeInTheDocument()

    await user.click(within(screen.getByTestId('undo-toast')).getByRole('button', { name: 'Desfazer' }))
    expect(topCard()).toHaveAccessibleName(/^Lavar a louça/)
  })

  it('lists recovered orphan tasks as a warning', async () => {
    const { user } = renderApp()
    const dialog = await openSettings(user)
    const withOrphan = { ...imported, decks: [imported.decks[0]] } as AppData

    await user.upload(within(dialog).getByLabelText('Importar backup (.json)'), backupFile(serializeBackup(withOrphan, { now: NOW })))

    expect(await within(dialog).findByText('1 tarefa sem baralho foi para “Recuperadas”.')).toBeInTheDocument()
  })

  it.each([
    ['not JSON', '{ nope', 'O arquivo não é um JSON válido.'],
    ['another format', JSON.stringify({ hello: 'world' }), 'Este arquivo não é um backup do taskdeck.'],
    [
      'a newer version',
      JSON.stringify({ app: 'taskdeck', schemaVersion: 3, decks: [], tasks: [] }),
      'Este backup é de uma versão mais nova do taskdeck (formato 3).',
    ],
    [
      'an invalid field',
      JSON.stringify({ app: 'taskdeck', schemaVersion: 1, decks: [{ id: 'd', name: '' }], tasks: [] }),
      'O backup tem um dado inválido em decks[0].name.',
    ],
  ])('rejects %s with an alert and changes nothing', async (_label, text, message) => {
    const { user } = renderApp()
    const dialog = await openSettings(user)

    await user.upload(within(dialog).getByLabelText('Importar backup (.json)'), backupFile(text))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message)
    expect(within(dialog).queryByRole('button', { name: 'Substituir meus dados' })).toBeNull()
    await user.keyboard('{Escape}')
    expect(topCard()).toHaveAccessibleName(/^Lavar a louça/)
  })

  it('cancelling the review keeps the current data', async () => {
    const { user } = renderApp()
    const dialog = await openSettings(user)

    await user.upload(within(dialog).getByLabelText('Importar backup (.json)'), backupFile(serializeBackup(imported, { now: NOW })))
    await user.click(await within(dialog).findByRole('button', { name: 'Cancelar' }))

    expect(within(dialog).queryByRole('group', { name: /baralhos/ })).toBeNull()
    await user.keyboard('{Escape}')
    expect(topCard()).toHaveAccessibleName(/^Lavar a louça/)
  })
})
