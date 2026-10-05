import { useI18n } from '../i18n/index.tsx'
import styles from './StorageBanner.module.css'

export interface StorageBannerProps {
  /** IndexedDB could not be opened: nothing survives a reload. */
  readonly memoryMode: boolean
  readonly saveFailed: boolean
  readonly onRetry: () => void
}

/** Persistent storage warnings, kept small so the deck stays usable. */
export function StorageBanner({ memoryMode, saveFailed, onRetry }: StorageBannerProps) {
  const { t } = useI18n()
  if (!memoryMode && !saveFailed) return null

  return (
    <div className={styles.banners}>
      {memoryMode && (
        <p className={styles.banner} role="status" data-testid="memory-warning">
          {t.storage.memoryWarning}
        </p>
      )}
      {saveFailed && (
        <div className={styles.banner} role="alert">
          <span>{t.storage.saveFailed}</span>
          <button type="button" className={styles.retry} onClick={onRetry}>
            {t.storage.retry}
          </button>
        </div>
      )}
    </div>
  )
}
