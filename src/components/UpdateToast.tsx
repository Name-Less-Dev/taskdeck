import { useI18n } from '../i18n/index.tsx'
import { Icon } from './Icon.tsx'
import styles from './UpdateToast.module.css'

export interface UpdateToastProps {
  readonly visible: boolean
  /** Activates the new version (reloads the page). */
  readonly onUpdate: () => void
  /** Hides the offer for this session. */
  readonly onLater: () => void
}

/**
 * "New version available · Update · Later". It never takes focus and never
 * acts on its own; the app's live region announces it when it appears.
 */
export function UpdateToast({ visible, onUpdate, onLater }: UpdateToastProps) {
  const { t } = useI18n()
  if (!visible) return null

  return (
    <div className={styles.toast} data-testid="update-toast">
      <Icon name="redo" size={18} />
      <span className={styles.message}>{t.pwa.updateAvailable}</span>
      <span className={styles.actions}>
        <button type="button" className={styles.update} onClick={onUpdate}>
          {t.pwa.update}
        </button>
        <button type="button" className={styles.later} onClick={onLater}>
          {t.pwa.later}
        </button>
      </span>
    </div>
  )
}
