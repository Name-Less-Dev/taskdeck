import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from './i18n/index.tsx'
import { Root, type RootProps } from './Root.tsx'
import {
  createIndexedDbStorage,
  createMemoryStorage,
  DEFAULT_META,
  openStorage,
  serializeBackup,
  type LoadResult,
} from './storage/index.ts'
import { fakePersistence } from './test/app.tsx'
import { freshIndexedDb } from './test/indexeddb.ts'
import { topCard } from './test/render.tsx'
import { createTask } from './domain/index.ts'

/**
 * End-to-end flows through Root on one fake IndexedDB: "reloading" means
 * unmounting and rendering Root again on the same database.
 */

const NOW = new Date(2026, 9, 5, 10, 0)
const names = { general: 'Geral', recovered: 'Recuperadas' }

let nextId = 0
function renderRoot(props: Partial<RootProps> = {}) {
  const download = vi.fn()
  const user = userEvent.setup()
  const result = render(
    <I18nProvider locale="pt-BR">
      <Root
        search=""
        browserLanguage="pt-BR"
        createId={() => `id-${String(++nextId)}`}
        persistence={fakePersistence()}
        download={download}
        {...props}
      />
    </I18nProvider>,
  )
  return { ...result, user, download }
}

/** What is on disk right now, through a separate connection. */
async function stored(): Promise<Extract<LoadResult, { ok: true }>> {
  const result = await (await createIndexedDbStorage({ createId: () => 'probe', names })).load()
  if (!result.ok) throw new Error('unexpected read-only database')
  return result
}

async function createTaskThroughUi(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole('button', { name: 'Nova tarefa' }))
  const dialog = screen.getByRole('dialog')
  await user.type(within(dialog).getByLabelText('Título'), title)
  await user.click(within(dialog).getByRole('button', { name: 'Criar tarefa' }))
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

describe('persistence across reloads', () => {
  it('a task created in the UI is there after a reload', async () => {
    const first = renderRoot()
    await first.user.click(await screen.findByRole('button', { name: 'Começar do zero' }))
    await createTaskThroughUi(first.user, 'Comprar pão')
    await waitFor(async () => {
      expect((await stored()).data.tasks.map((task) => task.title)).toEqual(['Comprar pão'])
    })
    first.unmount()

    renderRoot()

    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/^Comprar pão/)
    })
    expect(screen.queryByRole('button', { name: 'Carregar tarefas de exemplo' })).toBeNull()
  })

  it('remembers the active deck and the language', async () => {
    const first = renderRoot()
    await first.user.click(await screen.findByRole('button', { name: 'Começar do zero' }))

    await first.user.click(screen.getByRole('button', { name: /^Baralho:/ }))
    await first.user.type(screen.getByLabelText('Novo baralho'), 'Trabalho{Enter}')
    await first.user.click(screen.getByRole('button', { name: /^Trabalho/ }))
    await first.user.click(screen.getByRole('button', { name: 'Configurações' }))
    await first.user.click(screen.getByRole('radio', { name: 'English' }))
    // The whole UI switches language immediately.
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
    await waitFor(async () => {
      expect((await stored()).meta.settings).toMatchObject({ language: 'en' })
    })
    const saved = await stored()
    expect(saved.data.decks.find((deck) => deck.id === saved.meta.settings.activeDeckId)?.name).toBe('Trabalho')
    first.unmount()

    renderRoot()

    expect(await screen.findByRole('button', { name: 'Deck: Trabalho' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Complete' })).toBeInTheDocument()
  })

  it('never injects sample tasks over persisted data', async () => {
    const storage = await createIndexedDbStorage({ createId: () => 'x', names })
    await storage.save(
      { decks: [{ id: 'd', name: 'Casa' }], tasks: [createTask({ deckId: 'd', title: 'Minha tarefa' }, { id: 't', now: NOW })] },
      DEFAULT_META,
    )

    renderRoot()

    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/^Minha tarefa/)
    })
    expect(screen.queryByRole('button', { name: 'Carregar tarefas de exemplo' })).toBeNull()
    expect((await stored()).data.tasks).toHaveLength(1)
  })

  it('flushes immediately when the page is hidden, without waiting for the debounce', async () => {
    const memory = createMemoryStorage({ createId: () => 'g', names })
    const saves: string[][] = []
    const recording = {
      ...memory,
      save: (...args: Parameters<typeof memory.save>) => {
        saves.push(args[0].tasks.map((task) => task.title))
        return memory.save(...args)
      },
    }
    const { user } = renderRoot({ open: () => Promise.resolve({ storage: recording, mode: 'indexeddb', fallbackReason: null }) })
    await user.click(await screen.findByRole('button', { name: 'Começar do zero' }))
    await createTaskThroughUi(user, 'Salvar já')
    saves.length = 0

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    Reflect.deleteProperty(document, 'visibilityState')

    // The debounce is 300 ms: seeing the save well before that proves the flush.
    await waitFor(
      () => {
        expect(saves).toContainEqual(['Salvar já'])
      },
      { timeout: 150 },
    )
  })

  it('an imported backup survives a reload', async () => {
    const first = renderRoot()
    await first.user.click(await screen.findByRole('button', { name: 'Começar do zero' }))
    const backup = serializeBackup(
      { decks: [{ id: 'imp', name: 'Importado' }], tasks: [createTask({ deckId: 'imp', title: 'Do backup' }, { id: 'b1', now: NOW })] },
      { now: NOW },
    )
    await first.user.click(screen.getByRole('button', { name: 'Configurações' }))
    await first.user.upload(screen.getByLabelText('Importar backup (.json)'), new File([backup], 'b.json'))
    await first.user.click(await screen.findByRole('button', { name: 'Substituir meus dados' }))
    await waitFor(async () => {
      expect((await stored()).data.decks).toEqual([{ id: 'imp', name: 'Importado' }])
    })
    first.unmount()

    renderRoot()

    await waitFor(() => {
      expect(topCard()).toHaveAccessibleName(/^Do backup/)
    })
  })
})

describe('storage failures', () => {
  it('without IndexedDB: memory mode warning, and export still works', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const { user, download } = renderRoot()

    expect(await screen.findByTestId('memory-warning')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Começar do zero' }))
    await createTaskThroughUi(user, 'Só na memória')
    await user.click(screen.getByRole('button', { name: 'Configurações' }))
    await user.click(screen.getByRole('button', { name: 'Exportar backup (.json)' }))

    expect(download).toHaveBeenCalledTimes(1)
    const blob = download.mock.calls[0]?.[0] as Blob
    expect(await blob.text()).toContain('Só na memória')
  })

  it('a failed save shows "Tentar de novo", and retrying saves', async () => {
    const memory = createMemoryStorage({ createId: () => 'g', names })
    const realSave = memory.save.bind(memory)
    let failures = 1
    const flaky = {
      ...memory,
      save: (...args: Parameters<typeof memory.save>) => {
        if (failures > 0) {
          failures -= 1
          return Promise.reject(new DOMException('Quota exceeded', 'QuotaExceededError'))
        }
        return realSave(...args)
      },
    }
    const { user } = renderRoot({ open: () => Promise.resolve({ storage: flaky, mode: 'indexeddb', fallbackReason: null }) })
    await user.click(await screen.findByRole('button', { name: 'Começar do zero' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Não foi possível salvar as últimas alterações.')
    await user.click(within(alert).getByRole('button', { name: 'Tentar de novo' }))

    await waitFor(() => {
      expect(screen.queryByText('Não foi possível salvar as últimas alterações.')).toBeNull()
    })
    expect(memory.snapshot().meta).toMatchObject({ schemaVersion: 1 })
  })

  it('a newer version on disk opens read-only and is never overwritten', async () => {
    const storage = await createIndexedDbStorage({ createId: () => 'x', names })
    await storage.save({ decks: [{ id: 'd', name: 'Casa' }], tasks: [] }, { ...DEFAULT_META, schemaVersion: 5 })

    renderRoot({ open: (options) => openStorage(options) })

    expect(await screen.findByRole('alert', { name: 'Dados de uma versão mais nova' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nova tarefa' })).toBeNull()
    const raw = await (await createIndexedDbStorage({ createId: () => 'x', names })).load()
    expect(raw).toMatchObject({ ok: false, foundVersion: 5 })
  })
})
