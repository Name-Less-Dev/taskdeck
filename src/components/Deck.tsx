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
  readonly onExited: (action: SwipeAction) => void
  readonly onKeyDown?: KeyboardEventHandler<HTMLElement>
  readonly regionRef?: Ref<HTMLElement>
  /** Replaces the default "all caught up" message when there is no card. */
  readonly emptyState?: ReactNode
}

export function Deck({
  tasks,
  now,
  flippedId,
  exiting,
  onFlip,
  onRequestAction,
  onExited,
  onKeyDown,
  regionRef,
  emptyState,
}: DeckProps) {
  const { t } = useI18n()

  return (
    <section ref={regionRef} className={styles.region} aria-label={t.app.deckLabel} tabIndex={-1} onKeyDown={onKeyDown}>
      {tasks.length === 0 ? (
        (emptyState ?? <EmptyState />)
      ) : (
        tasks.slice(0, VISIBLE_CARDS).map((task, depth) => (
          <TaskCard
            key={task.id}
            task={task}
            now={now}
            depth={depth}
            flipped={depth === 0 && flippedId === task.id}
            exit={depth === 0 && exiting?.id === task.id ? exiting.action : null}
            onFlip={onFlip}
            onSwipe={onRequestAction}
            onExited={onExited}
          />
        ))
      )}
    </section>
  )
}
