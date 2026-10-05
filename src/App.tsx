import { useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from 'react'
import styles from './App.module.css'
import { ActionBar } from './components/ActionBar.tsx'
import { AddTaskSheet } from './components/AddTaskSheet.tsx'
import { Deck, type Exiting } from './components/Deck.tsx'
import { Icon } from './components/Icon.tsx'
import { UndoToast, type ToastData } from './components/UndoToast.tsx'
import { canRedo, canUndo, orderDeck, type Task } from './domain/index.ts'
import { useI18n } from './i18n/index.tsx'
import { createDeckState, deckReducer } from './state/deckReducer.ts'
import type { SwipeAction } from './ui/gestures.ts'
import { useNow } from './ui/useNow.ts'

export interface AppProps {
  readonly initialTasks: readonly Task[]
  /** Id factory for new tasks (injectable for tests). */
  readonly createId?: () => string
}

export const DEFAULT_DECK_ID = 'default'

function randomId(): string {
  return crypto.randomUUID()
}

const TOAST_MESSAGE_KEY = { complete: 'completed', postpone: 'postponed', remove: 'removed' } as const

export default function App({ initialTasks, createId = randomId }: AppProps) {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(deckReducer, initialTasks, createDeckState)
  const now = useNow()
  const tasks = useMemo(() => orderDeck(state.present, now), [state.present, now])
  const top = tasks[0] ?? null

  const [flippedId, setFlippedId] = useState<string | null>(null)
  const [exiting, setExiting] = useState<Exiting | null>(null)
  const [toast, setToast] = useState<ToastData | null>(null)
  const toastCounter = useRef(0)
  const [sheetOpen, setSheetOpen] = useState(false)

  const regionRef = useRef<HTMLElement>(null)
  const topCardRef = useRef<HTMLDivElement>(null)
  const [focusRequest, setFocusRequest] = useState(0)

  // After an action the card under focus is gone: move focus back to the deck.
  useEffect(() => {
    if (focusRequest === 0) return
    ;(topCardRef.current ?? regionRef.current)?.focus()
  }, [focusRequest])

  const busy = exiting !== null
  const undoAvailable = canUndo(state) && !busy
  const redoAvailable = canRedo(state) && !busy

  /** Gestures, buttons and keys share this path: exit animation first, dispatch after. */
  function requestAction(action: SwipeAction) {
    if (top === null || busy) return
    setExiting({ id: top.id, action })
  }

  function finishAction(action: SwipeAction) {
    if (exiting === null) return
    dispatch({ type: action, id: exiting.id, now: new Date() })
    setExiting(null)
    setFlippedId(null)
    toastCounter.current += 1
    setToast({ id: toastCounter.current, message: t.toast[TOAST_MESSAGE_KEY[action]] })
    setFocusRequest((n) => n + 1)
  }

  function undoLast() {
    if (!undoAvailable) return
    dispatch({ type: 'undo', now: new Date() })
    setToast(null)
    setFlippedId(null)
    setFocusRequest((n) => n + 1)
  }

  function redoLast() {
    if (!redoAvailable) return
    dispatch({ type: 'redo', now: new Date() })
    setToast(null)
    setFlippedId(null)
    setFocusRequest((n) => n + 1)
  }

  function addTask(task: Task) {
    dispatch({ type: 'add', task, now: new Date() })
    closeSheet()
  }

  function closeSheet() {
    setSheetOpen(false)
    setFocusRequest((n) => n + 1)
  }

  function toggleFlip() {
    if (top === null) return
    setFlippedId((current) => (current === top.id ? null : top.id))
  }

  function handleDeckKeyDown(event: KeyboardEvent<HTMLElement>) {
    const key = event.key.toLowerCase()
    const modifier = event.ctrlKey || event.metaKey

    if (modifier && (key === 'y' || (key === 'z' && event.shiftKey))) {
      event.preventDefault()
      redoLast()
      return
    }
    if (modifier && key === 'z') {
      event.preventDefault()
      undoLast()
      return
    }
    if (modifier || event.altKey) return

    switch (event.key) {
      case 'Enter':
      case ' ':
        // Only the card itself flips; Enter on another control keeps its meaning.
        if (event.target !== topCardRef.current) return
        event.preventDefault()
        toggleFlip()
        return
      case 'ArrowRight':
        event.preventDefault()
        requestAction('complete')
        return
      case 'ArrowLeft':
        event.preventDefault()
        requestAction('postpone')
        return
      case 'Delete':
      case 'Backspace':
        event.preventDefault()
        requestAction('remove')
        return
    }
  }

  return (
    <>
      <div className={styles.shell} inert={sheetOpen}>
        <header className={styles.header}>
          <h1 className={styles.brand}>{t.app.name}</h1>
          <div className={styles.history} role="group" aria-label={t.app.historyLabel}>
            <button type="button" className={styles.headerButton} disabled={!undoAvailable} onClick={undoLast}>
              <Icon name="undo" size={18} />
              <span>{t.actions.undo}</span>
            </button>
            <button type="button" className={styles.headerButton} disabled={!redoAvailable} onClick={redoLast}>
              <Icon name="redo" size={18} />
              <span>{t.actions.redo}</span>
            </button>
          </div>
          <button
            type="button"
            className={styles.addButton}
            aria-haspopup="dialog"
            onClick={() => {
              setSheetOpen(true)
            }}
          >
            <Icon name="plus" size={20} />
            <span>{t.actions.add}</span>
          </button>
        </header>

        <main className={styles.main}>
          <Deck
            tasks={tasks}
            now={now}
            flippedId={flippedId}
            exiting={exiting}
            onFlip={toggleFlip}
            onRequestAction={requestAction}
            onExited={finishAction}
            onKeyDown={handleDeckKeyDown}
            regionRef={regionRef}
            topCardRef={topCardRef}
          />
          <UndoToast
            toast={toast}
            onUndo={undoLast}
            onDismiss={() => {
              setToast(null)
            }}
          />
        </main>

        <ActionBar disabled={top === null || busy} onAction={requestAction} />
      </div>
      {sheetOpen && (
        <AddTaskSheet deckId={DEFAULT_DECK_ID} createId={createId} onCreate={addTask} onClose={closeSheet} />
      )}
    </>
  )
}
