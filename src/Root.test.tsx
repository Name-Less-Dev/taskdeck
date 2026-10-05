import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from './i18n/index.tsx'
import { Root, type RootProps } from './Root.tsx'
import { createIndexedDbStorage, openStorage, type OpenedStorage } from './storage/index.ts'
import { fakePersistence } from './test/app.tsx'
import { freshIndexedDb } from './test/indexeddb.ts'
import { topCard } from './test/render.tsx'

const NOW = new Date(2026, 9, 5, 10, 0)
const names = { general: 'Geral', recovered: 'Recuperadas' }

function renderRoot(props: Partial<RootProps> = {}) {
  let next = 0
  const download = vi.fn()
  const user = userEvent.setup()
  const result = render(
    <I18nProvider locale="pt-BR">
      <Root
        search=""
        browserLanguage="pt-BR"
        createId={() => `id-${String(++next)}`}
        persistence={fakePersistence()}
        download={download}
        {...props}
      />
    </I18nProvider>,
  )
  return { ...result, user, download }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  freshIndexedDb()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('startup', () => {
  it('shows a busy loading screen until storage has loaded', async () => {
    let release: (opened: OpenedStorage) => void = () => undefined
    const pending = new Promise<OpenedStorage>((resolve) => {
      release = resolve
    })
    const { container } = renderRoot({ open: () => pending })

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Carregando suas tarefas…')

    release(await openStorage({ createId: () => 'g', names }))

    expect(await screen.findByRole('heading', { name: 'Bem-vindo ao taskdeck' })).toBeInTheDocument()
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('offers sample tasks on first run and loads them into the default deck', async () => {
    const { user } = renderRoot()

    await user.click(await screen.findByRole('button', { name: 'Carregar tarefas de exemplo' }))

    expect(topCard()).toHaveAccessibleName(/Pagar a conta de luz/)
    expect(screen.getByText('8 tarefas de exemplo carregadas.')).toBeInTheDocument()
  })

  it('"Começar do zero" creates no task and is saved, so the offer does not come back', async () => {
    const { user, unmount } = renderRoot()

    await user.click(await screen.findByRole('button', { name: 'Começar do zero' }))
    expect(screen.getByRole('heading', { name: 'Tudo em dia!' })).toBeInTheDocument()
    await waitFor(async () => {
      const storage = await createIndexedDbStorage({ createId: () => 'x', names })
      expect(await storage.load()).toMatchObject({ ok: true, firstRun: false, data: { tasks: [] } })
    })
    unmount()

    renderRoot()
    expect(await screen.findByRole('heading', { name: 'Tudo em dia!' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Carregar tarefas de exemplo' })).toBeNull()
  })

  it('falls back to memory with a visible warning when IndexedDB cannot be opened', async () => {
    vi.stubGlobal('indexedDB', undefined)

    renderRoot()

    expect(await screen.findByTestId('memory-warning')).toHaveTextContent(
      'Seus dados não serão salvos neste navegador.',
    )
  })

  it('enters read-only mode for data from a newer version and can export it', async () => {
    const storage = await createIndexedDbStorage({ createId: () => 'x', names })
    await storage.save({ decks: [{ id: 'd', name: 'Casa' }], tasks: [] }, {
      schemaVersion: 2,
      settings: { activeDeckId: null, language: 'auto' },
      lastBackupAt: null,
    })
    const { user, download } = renderRoot()

    const alert = await screen.findByRole('alert', { name: 'Dados de uma versão mais nova' })
    expect(alert).toHaveTextContent('formato 2')
    expect(alert).toHaveTextContent('1 registro de baralho, 0 registros de tarefa')
    expect(screen.queryByRole('button', { name: 'Concluir' })).toBeNull()

    await user.click(within(alert).getByRole('button', { name: 'Exportar o que foi encontrado' }))
    expect(download).toHaveBeenCalledWith(expect.any(Blob), 'taskdeck-raw-export-2026-10-05.json')
  })

  it('shows the error screen if loading crashes unexpectedly', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { ErrorBoundary, ErrorScreen } = await import('./components/ErrorBoundary.tsx')

    render(
      <ErrorBoundary fallback={(error) => <ErrorScreen error={error} showDetails={false} />}>
        <Root search="" browserLanguage="pt-BR" open={() => Promise.reject(new Error('disk on fire'))} />
      </ErrorBoundary>,
    )

    expect(await screen.findByRole('alert', { name: 'Algo deu errado' })).toBeInTheDocument()
  })
})
