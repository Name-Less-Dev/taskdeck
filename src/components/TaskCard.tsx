import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from 'motion/react'
import { useEffect, useId, useRef, type CSSProperties } from 'react'
import { getDueStatus, type Priority, type Task } from '../domain/index.ts'
import { useI18n } from '../i18n/index.tsx'
import { cx } from '../ui/cx.ts'
import { dueTone, formatDueDate, formatDueStatus, formatRecurrence } from '../ui/format.ts'
import {
  decideSwipe,
  HORIZONTAL_DISTANCE_RATIO,
  VERTICAL_DISTANCE_RATIO,
  type SwipeAction,
} from '../ui/gestures.ts'
import { Icon, type IconName } from './Icon.tsx'
import styles from './TaskCard.module.css'

/** Pointer travel (px) before a press becomes a drag; shorter presses are taps (flip). */
export const DRAG_START_THRESHOLD_PX = 8

/** Maximum tilt (deg) while dragging, reached at 300 px of horizontal travel. */
const MAX_ROTATION_DEG = 12
const ROTATION_RANGE_PX = 300

const SPRING_BACK = { type: 'spring', stiffness: 500, damping: 32 } as const
const REDUCED_TRANSITION = { duration: 0.15 } as const
const EXIT_TRANSITION = { duration: 0.25, ease: 'easeIn' } as const

export interface TaskCardProps {
  readonly task: Task
  readonly now: Date
  /** 0 is the interactive top card; 1 and 2 are the decorative cards underneath. */
  readonly depth: number
  readonly flipped: boolean
  /** Set by the deck to play the exit animation; onExited fires when it ends. */
  readonly exit: SwipeAction | null
  readonly onFlip: () => void
  readonly onSwipe: (action: SwipeAction) => void
  readonly onExited: (action: SwipeAction) => void
  /** Deck name, shown on the card in the "All decks" view. */
  readonly deckName?: string
}

/** Attribute that marks the interactive top card, used to find it for focus. */
export const TOP_CARD_ATTRIBUTE = 'data-top-card'

const OVERLAYS: readonly { action: SwipeAction; icon: IconName }[] = [
  { action: 'complete', icon: 'check' },
  { action: 'postpone', icon: 'clock' },
  { action: 'remove', icon: 'trash' },
]

function progress(distance: number, threshold: number): number {
  return threshold > 0 ? Math.min(Math.max(distance / threshold, 0), 1) : 0
}

function PriorityShape({ priority }: { priority: Priority }) {
  const shape = {
    high: <polygon points="6,1 11,11 1,11" fill="currentColor" />,
    medium: <polygon points="6,1 11,6 6,11 1,6" fill="currentColor" />,
    low: <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />,
  }[priority]
  return (
    <svg aria-hidden="true" focusable="false" width="12" height="12" viewBox="0 0 12 12">
      {shape}
    </svg>
  )
}

export function TaskCard({ task, now, depth, flipped, exit, onFlip, onSwipe, onExited, deckName }: TaskCardProps) {
  const { locale, t } = useI18n()
  const reduceMotion = useReducedMotion() === true
  const isTop = depth === 0
  const backId = useId()

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const opacity = useMotionValue(1)
  const rotate = useTransform(x, [-ROTATION_RANGE_PX, ROTATION_RANGE_PX], [-MAX_ROTATION_DEG, MAX_ROTATION_DEG])

  // Card size in layout pixels (offsetWidth ignores the tilt transform).
  const sizeRef = useRef({ width: 0, height: 0 })
  const elementRef = useRef<HTMLDivElement | null>(null)
  const draggedRef = useRef(false)
  const controls = useDragControls()

  const completeOpacity = useTransform(x, (v) => progress(v, sizeRef.current.width * HORIZONTAL_DISTANCE_RATIO))
  const postponeOpacity = useTransform(x, (v) => progress(-v, sizeRef.current.width * HORIZONTAL_DISTANCE_RATIO))
  const removeOpacity = useTransform(y, (v) => progress(-v, sizeRef.current.height * VERTICAL_DISTANCE_RATIO))
  const overlayOpacity = { complete: completeOpacity, postpone: postponeOpacity, remove: removeOpacity }

  const onExitedRef = useRef(onExited)
  useEffect(() => {
    onExitedRef.current = onExited
  })

  useEffect(() => {
    if (exit === null) return
    let cancelled = false

    const run = async () => {
      if (reduceMotion) {
        await animate(opacity, 0, REDUCED_TRANSITION).finished
      } else {
        const target =
          exit === 'complete'
            ? { value: x, to: window.innerWidth * 1.2 }
            : exit === 'postpone'
              ? { value: x, to: -window.innerWidth * 1.2 }
              : { value: y, to: -window.innerHeight * 1.2 }
        await Promise.all([
          animate(target.value, target.to, EXIT_TRANSITION).finished,
          animate(opacity, 0, EXIT_TRANSITION).finished,
        ])
      }
      if (!cancelled) onExitedRef.current(exit)
    }
    void run()

    return () => {
      cancelled = true
    }
  }, [exit, reduceMotion, opacity, x, y])

  function measure() {
    const element = elementRef.current
    if (element !== null) sizeRef.current = { width: element.offsetWidth, height: element.offsetHeight }
  }

  function springBack() {
    const transition = reduceMotion ? REDUCED_TRANSITION : SPRING_BACK
    void animate(x, 0, transition)
    void animate(y, 0, transition)
  }

  function handleDragEnd(_event: unknown, info: PanInfo) {
    const action = decideSwipe({ offset: info.offset, velocity: info.velocity, size: sizeRef.current })
    if (action === null) springBack()
    else onSwipe(action)
  }

  const status = getDueStatus(task.due, now)
  const dueText = formatDueStatus(status, t)
  const priorityText = t.priority[task.priority]
  const interactive = isTop && exit === null

  return (
    <div
      className={styles.slot}
      style={{ '--depth': depth } as CSSProperties}
      aria-hidden={isTop ? undefined : true}
      inert={!isTop}
      data-testid={isTop ? 'top-card' : undefined}
    >
      <motion.div
        ref={elementRef}
        {...{ [TOP_CARD_ATTRIBUTE]: isTop ? 'true' : undefined }}
        className={cx(styles.card, isTop && styles.top)}
        style={{ x, y, opacity, rotate: reduceMotion ? 0 : rotate }}
        drag={interactive}
        dragListener={false}
        dragControls={controls}
        dragMomentum={false}
        onPointerDown={(event) => {
          if (!interactive) return
          draggedRef.current = false
          measure()
          controls.start(event, { distanceThreshold: DRAG_START_THRESHOLD_PX })
        }}
        onDragStart={() => {
          draggedRef.current = true
        }}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (!interactive) return
          if (draggedRef.current) {
            draggedRef.current = false
            return
          }
          onFlip()
        }}
        role={isTop ? 'button' : undefined}
        tabIndex={isTop ? 0 : -1}
        aria-pressed={isTop ? flipped : undefined}
        aria-label={isTop ? t.card.ariaLabel(task.title, dueText, priorityText, deckName) : undefined}
        aria-describedby={isTop && flipped ? backId : undefined}
      >
        <div className={cx(styles.inner, flipped && styles.flipped)}>
          <div className={cx(styles.face, styles.front)} aria-hidden={flipped}>
            <div className={styles.badges}>
              {deckName !== undefined && (
                <span className={styles.deckLabel}>
                  <Icon name="folder" size={14} />
                  <span className="visually-hidden">{t.decks.cardLabel}: </span>
                  {deckName}
                </span>
              )}
              <span className={styles.badge} data-tone={dueTone(status.kind)}>
                <Icon name="clock" size={14} />
                {dueText}
              </span>
              {task.postponedDays >= 1 && (
                <span className={styles.badge} data-tone="muted">
                  {t.card.postponedBadge(task.postponedDays)}
                </span>
              )}
            </div>
            <h2 className={styles.title}>{task.title}</h2>
            <div className={styles.footer}>
              <span className={styles.priority} data-priority={task.priority}>
                <PriorityShape priority={task.priority} />
                {t.priority.label}: {priorityText}
              </span>
              {task.recurrence !== null && (
                <span className={styles.repeat}>
                  <Icon name="repeat" size={14} />
                  {formatRecurrence(task.recurrence, t)}
                </span>
              )}
              {isTop && <span className={styles.hint}>{t.card.flipHint}</span>}
            </div>
          </div>

          <div id={backId} className={cx(styles.face, styles.back)} aria-hidden={!flipped}>
            <h3 className={styles.backHeading}>{t.card.description}</h3>
            <p className={styles.description}>{task.description === '' ? t.card.noDescription : task.description}</p>
            <dl className={styles.details}>
              <dt>{t.card.dueLabel}</dt>
              <dd>{formatDueDate(task.due, locale, t)}</dd>
              <dt>{t.priority.label}</dt>
              <dd>{priorityText}</dd>
              {task.recurrence !== null && (
                <>
                  <dt>{t.card.recurrenceLabel}</dt>
                  <dd>{formatRecurrence(task.recurrence, t)}</dd>
                </>
              )}
              <dt>{t.card.postponedLabel}</dt>
              <dd>{t.card.postponedCount(task.postponedDays)}</dd>
            </dl>
          </div>
        </div>

        {isTop &&
          OVERLAYS.map(({ action, icon }) => (
            <motion.div
              key={action}
              className={styles.overlay}
              data-action={action}
              style={{ opacity: overlayOpacity[action] }}
              aria-hidden="true"
            >
              <Icon name={icon} size={36} />
              <span>{t.actions[action]}</span>
            </motion.div>
          ))}
      </motion.div>
    </div>
  )
}
