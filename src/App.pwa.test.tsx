import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App, { type AppProps } from './App.tsx'
import { NO_PWA, PwaContext, type PwaState } from './pwa/context.ts'
import { createMemoryStorage, DEFAULT_META } from './storage/index.ts'
import { appProps } from './test/app.tsx'
import { renderWithI18n } from './test/render.tsx'

const DATA = { decks: [{ id: 'home', name: 'Casa' }], tasks: [] }

function renderApp(pwa: Partial<PwaState>, overrides: Partial<AppProps> = {}) {
  const state = { ...NO_PWA, update: vi.fn(), install: vi.fn(), ...pwa }
  const result = renderWithI18n(
    <PwaContext value={state}>
      <App {...appProps(DATA, overrides)} />
    </PwaContext>,
  )
  return { ...result, pwa: state }
}

async function openSettings(user: ReturnType<typeof renderApp>['user']) {
  await user.click(screen.getByRole('button', { name: 'Configurações' }))
  return screen.getByRole('dialog', { name: 'Configurações' })
}

describe('update prompt', () => {
  it('announces a waiting version and updates only when asked', async () => {
    const { user, pwa } = renderApp({ needRefresh: true })

    expect(screen.getByTestId('update-toast')).toHaveTextContent('Nova versão disponível')
    expect(screen.getByRole('status')).toHaveTextContent('Nova versão disponível')
    expect(pwa.update).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect(pwa.update).toHaveBeenCalledTimes(1)
  })

  it('"Depois" hides it for the session', async () => {
    const { user, pwa } = renderApp({ needRefresh: true })

    await user.click(screen.getByRole('button', { name: 'Depois' }))

    expect(screen.queryByTestId('update-toast')).toBeNull()
    expect(pwa.update).not.toHaveBeenCalled()
  })

  it('is not offered while a sheet (or a form) is open, and comes back after it closes', async () => {
    const { user } = renderApp({ needRefresh: true })

    await user.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    await user.type(screen.getByLabelText('Título'), 'Rascunho')
    expect(screen.queryByTestId('update-toast')).toBeNull()

    await user.keyboard('{Escape}')
    expect(screen.getByTestId('update-toast')).toBeInTheDocument()
  })

  it('shows nothing without a waiting version', () => {
    renderApp({ needRefresh: false })

    expect(screen.queryByTestId('update-toast')).toBeNull()
  })
})

describe('install and offline status in settings', () => {
  it('offers "Instalar app" when the browser can prompt', async () => {
    const { user, pwa } = renderApp({ canPrompt: true })
    const dialog = await openSettings(user)

    await user.click(within(dialog).getByRole('button', { name: 'Instalar app' }))

    expect(pwa.install).toHaveBeenCalledTimes(1)
  })

  it('shows nothing to install in standalone mode', async () => {
    const { user } = renderApp({ canPrompt: true, isIos: true, standalone: true })
    const dialog = await openSettings(user)

    expect(within(dialog).queryByRole('button', { name: 'Instalar app' })).toBeNull()
    expect(within(dialog).queryByText(/Adicionar à Tela de Início/)).toBeNull()
  })

  it('shows the iOS hint, and persists its dismissal', async () => {
    const storage = createMemoryStorage({ createId: () => 'g', names: { general: 'Geral', recovered: 'Recuperadas' } })
    const { user } = renderApp({ isIos: true }, { storage })
    const dialog = await openSettings(user)

    expect(within(dialog).getByText(/Compartilhar > Adicionar à Tela de Início/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Dispensar dica' }))

    expect(within(dialog).queryByText(/Adicionar à Tela de Início/)).toBeNull()
    await waitFor(() => {
      expect(storage.snapshot().meta).toMatchObject({ settings: { installHintDismissed: true } })
    })
  })

  it('does not show a dismissed iOS hint again', async () => {
    const { user } = renderApp(
      { isIos: true },
      { initialMeta: { ...DEFAULT_META, settings: { ...DEFAULT_META.settings, installHintDismissed: true } } },
    )
    const dialog = await openSettings(user)

    expect(within(dialog).queryByText(/Adicionar à Tela de Início/)).toBeNull()
  })

  it('says when the app is ready to use offline', async () => {
    const ready = renderApp({ offlineReady: true })
    expect(within(await openSettings(ready.user)).getByTestId('offline-status')).toHaveTextContent(
      'Pronto para usar offline',
    )
    ready.unmount()

    const notReady = renderApp({ offlineReady: false })
    expect(within(await openSettings(notReady.user)).getByTestId('offline-status')).toHaveTextContent(
      'Uso offline ainda não está pronto neste navegador.',
    )
  })
})
