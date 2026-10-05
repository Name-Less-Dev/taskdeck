import { useI18n } from '../i18n/index.tsx'
import { Icon } from './Icon.tsx'
import styles from './EmptyState.module.css'

export function EmptyState() {
  const { t } = useI18n()
  return (
    <div className={styles.empty}>
      <span className={styles.icon}>
        <Icon name="check" size={40} />
      </span>
      <h2 className={styles.title}>{t.empty.title}</h2>
      <p className={styles.body}>{t.empty.body}</p>
    </div>
  )
}
