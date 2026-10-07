import { useEffect, useId, useRef, type ReactNode } from 'react'
import type { RecurringTask, Task } from '../domain/index.ts'
import { useI18n } from '../i18n/index.tsx'
import { formatDueDate, formatRecurrence } from '../ui/format.ts'
import { Icon } from './Icon.tsx'
import styles from './ScheduledSheet.module.css'
import { Sheet } from './Sheet.tsx'

export interface ScheduledSheetProps {
  /** Snoozed until tomorrow (snoozedTasks), shown first. */
  readonly snoozed: readonly Task[]
  /** Dormant recurring tasks, soonest first (dormantTasks). */
  readonly dormant: readonly RecurringTask[]
  /** Deck names by id, shown on each item. */
  readonly deckNames: ReadonlyMap<string, string>
  readonly onBringBack: (id: string) => void
  readonly onCompleteNow: (id: string) => void
  readonly onEdit: (id: string) => void
  readonly onRemove: (id: string) => void
  readonly onClose: () => void
}

/**
 * "Scheduled": cards that are not on the deck today. "For tomorrow" lists the
 * snoozed ones (with "Bring back today"); "Upcoming" lists recurring cards
 * waiting for their day, with their rule and next date. Every item offers
 * Complete now, Edit and Delete (undoable from the toast). When an item
 * leaves the sheet, focus moves to the item now in its place, or to the
 * empty message.
 */
export function ScheduledSheet({
  snoozed,
  dormant,
  deckNames,
  onBringBack,
  onCompleteNow,
  onEdit,
  onRemove,
  onClose,
}: ScheduledSheetProps) {
  const { locale, t } = useI18n()
  const id = useId()
  const bodyRef = useRef<HTMLDivElement>(null)
  const emptyRef = useRef<HTMLParagraphElement>(null)
  const refocusAt = useRef<number | null>(null)

  useEffect(() => {
    const index = refocusAt.current
    if (index === null) return
    refocusAt.current = null
    const items = bodyRef.current?.querySelectorAll<HTMLElement>('[data-first-action]') ?? []
    const target = items[Math.min(index, items.length - 1)] ?? emptyRef.current
    target?.focus()
  }, [snoozed, dormant])

  function leaving(index: number, run: () => void) {
    refocusAt.current = index
    run()
  }

  function deckLine(task: Task): ReactNode {
    const deck = deckNames.get(task.deckId)
    return deck === undefined ? null : (
      <span>
        <Icon name="folder" size={14} />
        <span className="visually-hidden">{t.decks.cardLabel}: </span>
        {deck}
      </span>
    )
  }

  function commonActions(task: Task, index: number, first: boolean): ReactNode {
    return (
      <>
        <button
          type="button"
          className={styles.action}
          {...(first ? { 'data-first-action': true } : {})}
          aria-label={t.scheduled.completeNowLabel(task.title)}
          onClick={() => {
            // A snoozed one-off task leaves the sheet; a recurring one stays with its next date.
            leaving(index, () => {
              onCompleteNow(task.id)
            })
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
            leaving(index, () => {
              onRemove(task.id)
            })
          }}
        >
          <Icon name="trash" size={16} />
          <span>{t.actions.remove}</span>
        </button>
      </>
    )
  }

  const empty = snoozed.length === 0 && dormant.length === 0

  return (
    <Sheet title={t.scheduled.title} onClose={onClose}>
      <div ref={bodyRef}>
        {empty && (
          <p ref={emptyRef} className={styles.empty} tabIndex={-1}>
            {t.scheduled.empty}
          </p>
        )}

        {snoozed.length > 0 && (
          <section className={styles.group} aria-labelledby={`${id}-tomorrow`}>
            <h3 id={`${id}-tomorrow`} className={styles.groupHeading}>
              {t.scheduled.tomorrowHeading}
            </h3>
            <ul className={styles.list} aria-labelledby={`${id}-tomorrow`}>
              {snoozed.map((task, index) => (
                <li key={task.id} className={styles.item} data-testid="snoozed-item">
                  <h4 className={styles.title}>{task.title}</h4>
                  <p className={styles.meta}>
                    <span>
                      <Icon name="moon" size={14} /> {t.scheduled.backTomorrow}
                    </span>
                    {task.due !== null && (
                      <span>
                        <Icon name="calendar" size={14} /> {t.card.dueLabel}: {formatDueDate(task.due, locale, t)}
                      </span>
                    )}
                    {deckLine(task)}
                  </p>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.action}
                      data-first-action
                      aria-label={t.scheduled.bringBackLabel(task.title)}
                      onClick={() => {
                        leaving(index, () => {
                          onBringBack(task.id)
                        })
                      }}
                    >
                      <Icon name="undo" size={16} />
                      <span>{t.scheduled.bringBack}</span>
                    </button>
                    {commonActions(task, index, false)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {dormant.length > 0 && (
          <section className={styles.group} aria-labelledby={`${id}-upcoming`}>
            <h3 id={`${id}-upcoming`} className={styles.groupHeading}>
              {t.scheduled.upcomingHeading}
            </h3>
            <ul className={styles.list} aria-labelledby={`${id}-upcoming`}>
              {dormant.map((task, index) => (
                <li key={task.id} className={styles.item} data-testid="scheduled-item">
                  <h4 className={styles.title}>{task.title}</h4>
                  <p className={styles.meta}>
                    <span>
                      <Icon name="calendar" size={14} /> {t.scheduled.next(formatDueDate(task.due, locale, t))}
                    </span>
                    <span>
                      <Icon name="repeat" size={14} /> {formatRecurrence(task.recurrence, t)}
                    </span>
                    {deckLine(task)}
                  </p>
                  <div className={styles.actions}>{commonActions(task, snoozed.length + index, true)}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Sheet>
  )
}
