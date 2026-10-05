import type { TagCount } from '../domain/index.ts'
import { useI18n } from '../i18n/index.tsx'
import styles from './TagFilterBar.module.css'

export interface TagFilterBarProps {
  readonly counts: readonly TagCount[]
  readonly activeTag: string | null
  readonly onToggle: (tag: string | null) => void
}

/**
 * One toggle button per tag (aria-pressed) with its task count, in a
 * horizontally scrolling row, plus "Clear" while a filter is on.
 */
export function TagFilterBar({ counts, activeTag, onToggle }: TagFilterBarProps) {
  const { t } = useI18n()
  // Keep the active tag visible even when no task carries it any more.
  const shown =
    activeTag !== null && !counts.some((entry) => entry.tag === activeTag) ? [...counts, { tag: activeTag, count: 0 }] : counts
  if (shown.length === 0) return null

  return (
    <nav className={styles.bar} aria-label={t.tags.filterLabel}>
      <ul className={styles.list}>
        {shown.map(({ tag, count }) => (
          <li key={tag}>
            <button
              type="button"
              className={styles.tag}
              aria-pressed={activeTag === tag}
              aria-label={t.tags.filterButton(tag, count)}
              onClick={() => {
                onToggle(activeTag === tag ? null : tag)
              }}
            >
              <span>#{tag}</span>
              <span className={styles.count}>{count}</span>
            </button>
          </li>
        ))}
      </ul>
      {activeTag !== null && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => {
            onToggle(null)
          }}
        >
          {t.tags.clear}
        </button>
      )}
    </nav>
  )
}
