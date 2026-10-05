import type { ReactNode } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { Icon, type IconName } from './Icon.tsx'
import styles from './EmptyState.module.css'

export interface EmptyStateProps {
  readonly title?: string
  readonly body?: string
  readonly icon?: IconName
  /** Buttons offered with the message (first run, clear filter...). */
  readonly children?: ReactNode
}

/** Button classes for actions passed as children. */
export const emptyStateButton = { primary: styles.primary, secondary: styles.secondary }

/** Message shown instead of the cards. Defaults to "all caught up". */
export function EmptyState({ title, body, icon = 'check', children }: EmptyStateProps) {
  const { t } = useI18n()
  return (
    <div className={styles.empty}>
      <span className={styles.icon}>
        <Icon name={icon} size={40} />
      </span>
      <h2 className={styles.title}>{title ?? t.empty.title}</h2>
      <p className={styles.body}>{body ?? t.empty.body}</p>
      {children !== undefined && <div className={styles.actions}>{children}</div>}
    </div>
  )
}
