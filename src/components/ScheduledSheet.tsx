import { useEffect, useRef } from 'react'
import type { RecurringTask } from '../domain/index.ts'
import { useI18n } from '../i18n/index.tsx'
import { formatDueDate, formatRecurrence } from '../ui/format.ts'
import { Icon } from './Icon.tsx'
import styles from './ScheduledSheet.module.css'
import { Sheet } from './Sheet.tsx'

export interface ScheduledSheetProps {
  /** Dormant recurring tasks, soonest first (dormantTasks). */
  readonly tasks: readonly RecurringTask[]
  /** Deck names by id, shown on each item. */
  readonly deckNames: ReadonlyMap<string, string>
  readonly onCompleteNow: (id: string) => void
  readonly onEdit: (id: string) => void
  readonly onRemove: (id: string) => void
  readonly onClose: () => void
}

/**
 * "Scheduled": recurring cards waiting for their day, with their rule, next
 * date and deck, and "Complete now" / "Edit" / "Delete" (the first and the
 * last are undoable from the toast). When an item leaves the list, focus
 * moves to the item now in its place, or to the empty message.
 */
export function ScheduledSheet({ tasks, deckNames, onCompleteNow, onEdit, onRemove, onClose }: ScheduledSheetProps) {
  const { locale, t } = useI18n()
  const listRef = useRef<HTMLUListElement>(null)
  const emptyRef = useRef<HTMLParagraphElement>(null)
  const refocusAt = useRef<number | null>(null)

  useEffect(() => {
    const index = refocusAt.current
    if (index === null) return
    refocusAt.current = null
    const items = listRef.current?.querySelectorAll<HTMLElement>('[data-first-action]') ?? []
    const target = items[Math.min(index, items.length - 1)] ?? emptyRef.current
    target?.focus()
  }, [tasks])

  return (
    <Sheet title={t.scheduled.title} onClose={onClose}>
      {tasks.length === 0 ? (
        <p ref={emptyRef} className={styles.empty} tabIndex={-1}>
          {t.scheduled.empty}
        </p>
      ) : (
        <ul ref={listRef} className={styles.list} aria-label={t.scheduled.title}>
          {tasks.map((task, index) => {
            const deck = deckNames.get(task.deckId)
            return (
              <li key={task.id} className={styles.item} data-testid="scheduled-item">
                <h3 className={styles.title}>{task.title}</h3>
                <p className={styles.meta}>
                  <span>
                    <Icon name="calendar" size={14} /> {t.scheduled.next(formatDueDate(task.due, locale, t))}
                  </span>
                  <span>
                    <Icon name="repeat" size={14} /> {formatRecurrence(task.recurrence, t)}
                  </span>
                  {deck !== undefined && (
                    <span>
                      <Icon name="folder" size={14} />
                      <span className="visually-hidden">{t.decks.cardLabel}: </span>
                      {deck}
                    </span>
                  )}
                </p>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.action}
                    data-first-action
                    aria-label={t.scheduled.completeNowLabel(task.title)}
                    onClick={() => {
                      onCompleteNow(task.id)
                    }}
                  >
                    <Icon name="check" size={16} />
                    <span>{t.scheduled.completeNow}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.action}
                    aria-label={t.card.editLabel(task.title)}
                    onClick={() => {
                      onEdit(task.id)
                    }}
                  >
                    <Icon name="pencil" size={16} />
                    <span>{t.card.edit}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.action}
                    aria-label={t.scheduled.removeLabel(task.title)}
                    onClick={() => {
                      refocusAt.current = index
                      onRemove(task.id)
                    }}
                  >
                    <Icon name="trash" size={16} />
                    <span>{t.actions.remove}</span>
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
