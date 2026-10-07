import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App, { type AppProps } from './App.tsx'
import { I18nProvider } from './i18n/index.tsx'
import { Root } from './Root.tsx'
import { createMemoryStorage, DEFAULT_META, MetaSchema } from './storage/index.ts'
import { appProps, fakePersistence } from './test/app.tsx'
import { freshIndexedDb } from './test/indexeddb.ts'
import { renderWithI18n } from './test/render.tsx'

const DATA = { decks: [{ id: 'home', name: 'Casa' }], tasks: [] }
const names = { general: 'Geral', recovered: 'Recuperadas' }

function renderApp(overrides: Partial<AppProps> = {}) {
  return renderWithI18n(<App {...appProps(DATA, overrides)} />)
}

const howTo = () => screen.queryByRole('dialog', { name: 'Como usar' })

describe('how-to entry points', () => {
  it('never opens on its own, not even on the first run', () => {
    renderApp({ firstRun: true })

    expect(howTo()).toBeNull()
  })

  it('"Como usar" in Settings > Ajuda opens it, and closing goes back to Settings with focus on that button', async () => {
    const { user } = renderApp()
    await user.click(screen.getByRole('button', { name: 'Configurações' }))
    const settings = screen.getByRole('dialog', { name: 'Configurações' })
    const help = within(settings).getByRole('button', { name: 'Como usar: abrir o tutorial' })
    expect(within(settings).getByRole('heading', { name: 'Ajuda' })).toBeInTheDocument()

    await user.click(help)
    expect(howTo()).not.toBeNull()
    await user.keyboard('{Escape}')

    const back = screen.getByRole('dialog', { name: 'Configurações' })
    expect(within(back).getByRole('button', { name: 'Como usar: abrir o tutorial' })).toHaveFocus()
  })

  it('the first-run screen offers "Ver como funciona" next to the two main choices', async () => {
    const { user } = renderApp({ firstRun: true })
    const link = screen.getByRole('button', { name: 'Ver como funciona' })
    expect(screen.getByRole('button', { name: 'Carregar tarefas de exemplo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Começar do zero' })).toBeInTheDocument()

    await user.click(link)
    expect(howTo()).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Pular' }))

    // Seen now: the link does not come back.
    expect(howTo()).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ver como funciona' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Carregar tarefas de exemplo' })).toBeInTheDocument()
  })

  it('the first-run link is only on the first-run screen, and not once the tutorial was seen', () => {
    const seen = renderApp({
      firstRun: true,
      initialMeta: { ...DEFAULT_META, settings: { ...DEFAULT_META.settings, tutorialSeen: true } },
    })
    expect(screen.queryByRole('button', { name: 'Ver como funciona' })).toBeNull()
    seen.unmount()

    renderApp({ firstRun: false })
    expect(screen.queryByRole('button', { name: 'Ver como funciona' })).toBeNull()
  })

  it.each(['Pular', 'Fechar', 'Concluir'])('"%s" marks the tutorial as seen in meta', async (button) => {
    const storage = createMemoryStorage({ createId: () => 'g', names })
    const { user } = renderApp({ storage, openHowToOnLoad: true })
    if (button === 'Concluir') {
      for (let i = 0; i < 4; i += 1) await user.click(screen.getByRole('button', { name: 'Próximo' }))
    }

    await user.click(within(howTo() as HTMLElement).getByRole('button', { name: button }))

    await waitFor(() => {
      expect(storage.snapshot().meta).toMatchObject({ settings: { tutorialSeen: true } })
    })
  })

  it('older meta without tutorialSeen loads with false (no migration)', () => {
    const old = { schemaVersion: 1, settings: { activeDeckId: null, language: 'auto' }, lastBackupAt: null }

    expect(MetaSchema.parse(old).settings.tutorialSeen).toBe(false)
  })
})

describe('?help=1', () => {
  beforeEach(() => {
    freshIndexedDb()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function renderRoot(search: string) {
    let next = 0
    render(
      <I18nProvider locale="pt-BR">
        <Root
          search={search}
          browserLanguage="pt-BR"
          createId={() => `id-${String(++next)}`}
          persistence={fakePersistence()}
          download={vi.fn()}
        />
      </I18nProvider>,
    )
    await screen.findByRole('heading', { name: 'Bem-vindo ao taskdeck' })
  }

  it('opens the how-to when the app loads', async () => {
    await renderRoot('?help=1')

    expect(await screen.findByRole('dialog', { name: 'Como usar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próximo' })).toHaveFocus()
  })

  it('without it, the app opens normally', async () => {
    await renderRoot('')

    expect(howTo()).toBeNull()
  })

  it('closing it returns focus to the deck', async () => {
    await renderRoot('?help=1')
    const user = userEvent.setup()

    await user.keyboard('{Escape}')

    expect(howTo()).toBeNull()
    expect(screen.getByRole('region', { name: 'Baralho de tarefas' })).toHaveFocus()
  })
})
