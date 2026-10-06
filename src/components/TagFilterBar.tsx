import { useId } from 'react'
import type { TagCount } from '../domain/index.ts'
import { useI18n } from '../i18n/index.tsx'
import { useBooleanPreference } from '../ui/preferences.ts'
import { Icon } from './Icon.tsx'
import styles from './TagFilterBar.module.css'
import { tagHue } from '../ui/theme.ts'

/** localStorage key (see src/ui/preferences.ts) for the open/closed state. */
export const TAG_FILTER_OPEN_PREFERENCE = 'tagFilterOpen'

export interface TagFilterBarProps {
  readonly counts: readonly TagCount[]
  readonly activeTag: string | null
  readonly onToggle: (tag: string | null) => void
}

/**
 * "Filter by tag" disclosure (collapsed by default, state kept as an
 * interface preference) controlling a bar of toggle buttons (aria-pressed)
 * with counts. While a filter is on, the button shows an indicator and a
 * dismissible "tag: X ×" chip stays visible outside the bar.
 * Nothing is rendered when no task has tags.
 */
export function TagFilterBar({ counts, activeTag, onToggle }: TagFilterBarProps) {
  const { t } = useI18n()
  const barId = useId()
  const [open, setOpen] = useBooleanPreference(TAG_FILTER_OPEN_PREFERENCE, false)
  // Keep the active tag visible even when no task carries it any more.
  const shown =
    activeTag !== null && !counts.some((entry) => entry.tag === activeTag) ? [...counts, { tag: activeTag, count: 0 }] : counts
  if (shown.length === 0) return null

  return (
    <div className={styles.filter}>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={barId}
          onClick={() => {
            setOpen(!open)
          }}
        >
          <Icon name="tag" size={18} />
          <span>{t.tags.filterLabel}</span>
          {activeTag !== null && (
            <>
              <span className={styles.indicator} aria-hidden="true" data-testid="tag-filter-indicator" />
              {/* The space separates the words in the accessible name. */}{" "}
              <span className="visually-hidden">{t.tags.filterOn}</span>
            </>
          )}
          <span className={styles.chevron}>
            <Icon name="chevron" size={16} />
          </span>
        </button>
        {activeTag !== null && (
          <button
            type="button"
            className={styles.chip}
            aria-label={t.tags.removeFilter(activeTag)}
            onClick={() => {
              onToggle(null)
            }}
          >
            <span className={styles.chipText}>{t.tags.chip(activeTag)}</span>
            <Icon name="close" size={14} />
          </button>
        )}
      </div>

      <nav id={barId} className={styles.bar} aria-label={t.tags.filterLabel} hidden={!open}>
        <ul className={styles.list}>
          {shown.map(({ tag, count }) => (
            <li key={tag}>
              <button
                type="button"
                className={styles.tag}
                data-tag-hue={tagHue(tag)}
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
    </div>
  )
}
