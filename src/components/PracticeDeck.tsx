import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { availableTasks, createTask, orderDeck, type AppData } from '../domain/index.ts'
import { useI18n } from '../i18n/index.tsx'
import { createDeckState, deckReducer, type DeckState } from '../state/deckReducer.ts'
import { swipeActionForKey } from '../ui/deckKeys.ts'
import { EXIT_TIMEOUT_MS, exitReducer, IDLE, isExiting, type ExitEvent, type ExitState } from '../ui/exitState.ts'
import type { SwipeAction } from '../ui/gestures.ts'
import { ActionBar } from './ActionBar.tsx'
import { Deck } from './Deck.tsx'
import form from './Form.module.css'
import styles from './PracticeDeck.module.css'
import { TOP_CARD_ATTRIBUTE } from './TaskCard.tsx'

/** Fixed clock of the practice: nothing in it depends on the real time. */
export const PRACTICE_NOW = new Date(2026, 0, 5, 12, 0)

/** Without success for this long, a non-blocking hint names the button to use. */
export const PRACTICE_HINT_MS = 8000

const PRACTICE_DECK_ID = 'practice'

export interface PracticeDeckProps {
  /** The actions to do, in order (e.g. complete, then later). */
  readonly exercises: readonly SwipeAction[]
  /** Every exercise was done (by any input). */
  readonly onComplete: () => void
  /** "Skip this step". */
  readonly onSkip: () => void
}

type Feedback = { readonly kind: 'wrong'; readonly did: SwipeAction } | null

/**
 * A practice deck for the how-to, built from the REAL Deck (TaskCard,
 * decideSwipe) and ActionBar, driven by the real pure reducer on a SEPARATE
 * in-memory state with its own history and a fixed clock. It never touches
 * the app's state, storage, reminders, calendar or live region: it has its
 * own live region. Any input counts (drag, button or key).
 */
export function PracticeDeck({ exercises, onComplete, onSkip }: PracticeDeckProps) {
  const { t } = useI18n()
  const id = useId()
  const [exercise, setExercise] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [deck, setDeck] = useState<DeckState>(() => createDeckState(practiceData(0)))
  const [exitState, setExitState] = useState<ExitState>(IDLE)
  const [flipped, setFlipped] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [hint, setHint] = useState(false)
  const [announcement, setAnnouncement] = useState<{ id: number; text: string } | null>(null)
  const regionRef = useRef<HTMLElement>(null)
  const expected = exercises[exercise] ?? exercises[0] ?? 'complete'

  function practiceData(round: number): AppData {
    return {
      decks: [{ id: PRACTICE_DECK_ID, name: t.practice.deckName }],
      tasks: [
        createTask(
          { deckId: PRACTICE_DECK_ID, title: t.practice.cardTitle, description: t.practice.cardBody },
          { id: `practice-${String(round)}`, now: PRACTICE_NOW },
        ),
      ],
    }
  }

  // The same visibility rule as the real deck (a snoozed practice card leaves it).
  const tasks = orderDeck(availableTasks(deck.present.tasks, PRACTICE_NOW), PRACTICE_NOW)
  const top = tasks[0] ?? null
  const exiting = isExiting(exitState) ? { id: exitState.id, action: exitState.action } : null

  function announce(text: string) {
    setAnnouncement((current) => ({ id: (current?.id ?? 0) + 1, text }))
  }

  /** A fresh card for the current (or next) exercise. */
  function freshCard(nextExercise: number) {
    const round = attempt + 1
    setAttempt(round)
    setExercise(nextExercise)
    setDeck(createDeckState(practiceData(round)))
    setExitState(IDLE)
    setFlipped(false)
    setFeedback(null)
  }

  function commit(action: SwipeAction, taskId: string) {
    setDeck((current) => deckReducer(current, { type: action, id: taskId, now: PRACTICE_NOW }))
    setFlipped(false)
    if (action !== expected) {
      setFeedback({ kind: 'wrong', did: action })
      announce(`${t.practice.did[action]} ${t.practice.nowTry[expected]}`)
      return
    }
    const next = exercise + 1
    if (next >= exercises.length) {
      announce(t.practice.stepDone)
      onComplete()
      return
    }
    const nextAction = exercises[next] ?? expected
    announce(`${t.practice.wellDone} ${t.practice.prompt[nextAction]}`)
    freshCard(next)
  }

  function handleExit(event: ExitEvent) {
    const { state: next, commit: done } = exitReducer(exitState, event)
    if (next !== exitState) setExitState(next)
    if (done !== null) commit(done.action, done.id)
  }

  function requestAction(action: SwipeAction) {
    handleExit({ type: 'request', topId: top?.id ?? null, action, at: performance.now() })
  }

  // Same safety net as the real deck: an exit always ends (see exitState.ts).
  const handleExitRef = useRef(handleExit)
  useEffect(() => {
    handleExitRef.current = handleExit
  })
  useEffect(() => {
    if (!isExiting(exitState)) return
    const timer = setTimeout(() => {
      handleExitRef.current({ type: 'timeout', at: performance.now() })
    }, EXIT_TIMEOUT_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [exitState])

  // A gentle hint when nothing has worked for a while; never blocks anything.
  useEffect(() => {
    setHint(false)
    const timer = setTimeout(() => {
      setHint(true)
    }, PRACTICE_HINT_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [exercise, attempt])

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const onCard = event.target instanceof HTMLElement && event.target.hasAttribute(TOP_CARD_ATTRIBUTE)
    if ((event.key === 'Enter' || event.key === ' ') && onCard) {
      event.preventDefault()
      setFlipped((current) => !current)
      return
    }
    const action = swipeActionForKey(event.key)
    if (action === null) return
    event.preventDefault()
    requestAction(action)
  }

  return (
    <div className={styles.practice} data-testid="practice-deck">
      <p className={styles.badge}>{t.practice.notSaved}</p>
      <p id={`${id}-prompt`} className={styles.prompt}>
        {t.practice.prompt[expected]}
      </p>
      <div className={styles.deck}>
        <Deck
          tasks={tasks}
          now={PRACTICE_NOW}
          label={t.practice.deckLabel}
          flippedId={flipped ? (top?.id ?? null) : null}
          exiting={exiting}
          onFlip={() => {
            setFlipped((current) => !current)
          }}
          onRequestAction={requestAction}
          onExited={(taskId) => {
            handleExit({ type: 'finished', id: taskId })
          }}
          onExitInterrupted={(taskId) => {
            handleExit({ type: 'interrupted', id: taskId })
          }}
          onKeyDown={handleKeyDown}
          regionRef={regionRef}
          emptyState={<p className={styles.gone}>{t.practice.cardGone}</p>}
        />
      </div>
      <ActionBar disabled={top === null || exiting !== null} onAction={requestAction} showShortcuts={false} />

      {feedback !== null && (
        <div className={styles.feedback}>
          <p>
            {t.practice.did[feedback.did]} {t.practice.nowTry[expected]}
          </p>
          <button
            type="button"
            className={form.secondary}
            onClick={() => {
              freshCard(exercise)
            }}
          >
            {t.practice.tryAgain}
          </button>
        </div>
      )}
      {hint && feedback === null && <p className={styles.hint}>{t.practice.hint(t.actions[expected])}</p>}

      <button type="button" className={styles.skip} onClick={onSkip}>
        {t.practice.skipStep}
      </button>

      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {announcement !== null && <span key={announcement.id}>{announcement.text}</span>}
      </div>
    </div>
  )
}
