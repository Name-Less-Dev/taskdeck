import { useEffect, useState } from 'react'
import App from './App.tsx'
import { LoadingScreen, ReadOnlyScreen } from './components/StartupScreens.tsx'
import { dictionaries, I18nProvider, detectLocale, isLocaleForcedByUrl, resolveLocale } from './i18n/index.tsx'
import { toDayKey } from './domain/index.ts'
import { createId as randomId } from './lib/id.ts'
import {
  openStorage,
  serializeRawBackup,
  type IndexedDbOptions,
  type Language,
  type LoadResult,
  type OpenedStorage,
} from './storage/index.ts'
import { downloadBlob, jsonBlob, type Download } from './ui/download.ts'
import { browserPersistence, type PersistenceApi } from './ui/usePersistence.ts'

export interface RootProps {
  /** Opens storage; defaults to IndexedDB with in-memory fallback. */
  readonly open?: (options: IndexedDbOptions) => Promise<OpenedStorage>
  readonly createId?: () => string
  readonly persistence?: PersistenceApi
  readonly download?: Download
  /** Location and browser language, injectable for tests. */
  readonly search?: string
  readonly browserLanguage?: string
}

type Boot =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly opened: OpenedStorage; readonly result: Extract<LoadResult, { ok: true }> }
  | { readonly status: 'read-only'; readonly result: Extract<LoadResult, { ok: false }> }
  | { readonly status: 'failed'; readonly error: unknown }

/**
 * Opens storage and loads before rendering the app. Owns the language
 * setting because the i18n provider must wrap everything, including the
 * loading and read-only screens.
 */
export function Root({
  open = openStorage,
  createId = randomId,
  persistence = browserPersistence,
  download = downloadBlob,
  search = window.location.search,
  browserLanguage = navigator.language,
}: RootProps) {
  const [boot, setBoot] = useState<Boot>({ status: 'loading' })
  const [language, setLanguage] = useState<Language>('auto')
  const locale = resolveLocale({ search, language: browserLanguage, setting: language })

  useEffect(() => {
    let alive = true
    // Repairs (default deck, recovered tasks) are named in the language the
    // user sees on startup; the stored preference is not known yet.
    const t = dictionaries[detectLocale({ search, language: browserLanguage })]
    const run = async () => {
      const opened = await open({
        createId,
        names: { general: t.startup.generalDeck, recovered: t.startup.recoveredDeck },
      })
      const result = await opened.storage.load()
      if (!alive) return
      if (result.ok) {
        setLanguage(result.meta.settings.language)
        setBoot({ status: 'ready', opened, result })
      } else {
        setBoot({ status: 'read-only', result })
      }
    }
    run().catch((error: unknown) => {
      if (alive) setBoot({ status: 'failed', error })
    })
    return () => {
      alive = false
    }
    // Load exactly once per mount; later prop changes do not reload storage.
  }, [])

  // Rethrown during render so the root ErrorBoundary shows its screen.
  if (boot.status === 'failed') throw boot.error

  return (
    <I18nProvider locale={locale}>
      {boot.status === 'loading' && <LoadingScreen />}
      {boot.status === 'read-only' && (
        <ReadOnlyScreen
          result={boot.result}
          onExport={() => {
            const now = new Date()
            download(
              jsonBlob(serializeRawBackup(boot.result.raw, { now })),
              `taskdeck-raw-export-${toDayKey(now)}.json`,
            )
          }}
        />
      )}
      {boot.status === 'ready' && (
        <App
          initialData={boot.result.data}
          initialMeta={boot.result.meta}
          firstRun={boot.result.firstRun}
          quarantineTotal={boot.result.quarantineTotal}
          storage={boot.opened.storage}
          storageMode={boot.opened.mode}
          language={language}
          onLanguageChange={setLanguage}
          languageForcedByUrl={isLocaleForcedByUrl(search)}
          createId={createId}
          persistence={persistence}
          download={download}
          openHowToOnLoad={new URLSearchParams(search).get('help') === '1'}
        />
      )}
    </I18nProvider>
  )
}
