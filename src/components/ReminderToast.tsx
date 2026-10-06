import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { Icon } from './Icon.tsx'
import styles from './ReminderToast.module.css'

/** How long a reminder stays on screen. */
export const REMINDER_TOAST_MS = 10_000

export interface ReminderToastProps {
  /** Changes for every reminder; null hides the toast. */
  readonly id: number | null
  readonly message: string
  readonly tone: 'warning' | 'danger'
  readonly onDismiss: () => void
}

/**
 * Discreet notice for due-date changes. It never takes focus (the live
 * region announces it), closes with its button or Escape, and goes away on
 * its own after REMINDER_TOAST_MS.
 */
export function ReminderToast({ id, message, tone, onDismiss }: ReminderToastProps) {
  const { t } = useI18n()
  const onDismissRef = useRef(onDismiss)
  useEffect(() => {
    onDismissRef.current = onDismiss
  })

  useEffect(() => {
    if (id === null) return
    const timer = setTimeout(() => {
      onDismissRef.current()
    }, REMINDER_TOAST_MS)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onDismissRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [id])

  if (id === null) return null

  return (
    <div className={styles.toast} data-tone={tone} data-testid="reminder-toast">
      <Icon name={tone === 'danger' ? 'alert' : 'clock'} size={18} />
      <span className={styles.message}>{message}</span>
      <button type="button" className={styles.dismiss} aria-label={t.reminders.dismiss} onClick={onDismiss}>
        <Icon name="close" size={16} />
      </button>
    </div>
  )
}
