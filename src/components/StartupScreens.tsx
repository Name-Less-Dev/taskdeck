import { useI18n } from '../i18n/index.tsx'
import type { LoadResult } from '../storage/index.ts'
import styles from './Screen.module.css'

/** Shown while storage opens and loads; the app renders only after that. */
export function LoadingScreen() {
  const { t } = useI18n()
  return (
    <main className={styles.screen} aria-busy="true">
      <div className={styles.skeleton} aria-hidden="true" />
      <p className="visually-hidden" role="status">
        {t.startup.loading}
      </p>
    </main>
  )
}

export interface ReadOnlyScreenProps {
  readonly result: Extract<LoadResult, { ok: false }>
  readonly onExport: () => void
}

/**
 * The stored data comes from a newer (or unmigratable) version: nothing is
 * shown as editable and nothing is written, but the raw records can be
 * exported so they are never lost.
 */
export function ReadOnlyScreen({ result, onExport }: ReadOnlyScreenProps) {
  const { t } = useI18n()
  return (
    <main className={styles.screen}>
      <div className={styles.panel} role="alert" aria-labelledby="read-only-title">
        <h1 id="read-only-title" className={styles.title}>
          {t.readOnly.title}
        </h1>
        <p className={styles.text}>
          {result.error === 'newer-version'
            ? t.readOnly.newerVersion(result.foundVersion, result.supportedVersion)
            : t.readOnly.missingMigration(result.foundVersion)}
        </p>
        <p className={styles.text}>{t.readOnly.untouched}</p>
        <p className={styles.text}>{t.readOnly.found(result.raw.decks.length, result.raw.tasks.length)}</p>
        <button type="button" className={styles.primary} onClick={onExport}>
          {t.readOnly.export}
        </button>
      </div>
    </main>
  )
}
