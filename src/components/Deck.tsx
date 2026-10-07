import type { KeyboardEventHandler, ReactNode, Ref } from 'react'
import type { Task } from '../domain/index.ts'
import { useI18n } from '../i18n/index.tsx'
import type { SwipeAction } from '../ui/gestures.ts'
import styles from './Deck.module.css'
import { EmptyState } from './EmptyState.tsx'
import { TaskCard } from './TaskCard.tsx'

/** How many cards are drawn: the top one plus two decorative ones underneath. */
export const VISIBLE_CARDS = 3

export interface Exiting {
  readonly id: string
  readonly action: SwipeAction
}

export interface DeckProps {
  /** Ordered deck, top card first. */
  readonly tasks: readonly Task[]
  readonly now: Date
  readonly flippedId: string | null
  readonly exiting: Exiting | null
  readonly onFlip: () => void
  readonly onRequestAction: (action: SwipeAction) => void
  /** The exit animation of card `id` finished. */
  readonly onExited: (id: string) => void
  /** The exit animation of card `id` stopped before finishing (lost the top, unmounted). */
  readonly onExitInterrupted?: (id: string) => void
  readonly onKeyDown?: KeyboardEventHandler<HTMLElement>
  readonly regionRef?: Ref<HTMLElement>
  /** Replaces the default "all caught up" message when there is no card. */
  readonly emptyState?: ReactNode
  /** Deck names by id: when given ("All decks" view) each card shows its deck. */
  readonly deckNames?: ReadonlyMap<string, string>
  /** Opens the edit sheet for the top card. */
  readonly onEdit?: () => void
  /** Exports the top card to a calendar file. */
  readonly onAddToCalendar?: () => void
  /** Accessible name of the region (the practice deck has its own). */
  readonly label?: string
}

export function Deck({
  tasks,
  now,
  flippedId,
  exiting,
  onFlip,
  onRequestAction,
  onExited,
  onExitInterrupted,
  onKeyDown,
  regionRef,
  emptyState,
  deckNames,
  onEdit,
  onAddToCalendar,
  label,
}: DeckProps) {
  const { t } = useI18n()

  return (
    <section ref={regionRef} className={styles.region} aria-label={label ?? t.app.deckLabel} tabIndex={-1} onKeyDown={onKeyDown}>
      {tasks.length === 0
        ? (emptyState ?? <EmptyState />)
        : tasks.slice(0, VISIBLE_CARDS).map((task, depth) => (
            <TaskCard
              key={task.id}
              task={task}
              now={now}
              depth={depth}
              flipped={depth === 0 && flippedId === task.id}
              // Not tied to depth: a card that loses the top mid-exit keeps animating out.
              exit={exiting?.id === task.id ? exiting.action : null}
              onFlip={onFlip}
              onSwipe={onRequestAction}
              onExited={() => {
                onExited(task.id)
              }}
              onExitInterrupted={() => {
                onExitInterrupted?.(task.id)
              }}
              {...(depth === 0 && onEdit !== undefined ? { onEdit } : {})}
              {...(depth === 0 && onAddToCalendar !== undefined ? { onAddToCalendar } : {})}
              {...(deckNames?.has(task.deckId) === true ? { deckName: deckNames.get(task.deckId) } : {})}
            />
          ))}
    </section>
  )
}
