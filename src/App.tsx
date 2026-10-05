import { useMemo, useReducer, useRef, useState } from 'react'
import styles from './App.module.css'
import { Deck, type Exiting } from './components/Deck.tsx'
import { orderDeck, type Task } from './domain/index.ts'
import { useI18n } from './i18n/index.tsx'
import { createDeckState, deckReducer } from './state/deckReducer.ts'
import type { SwipeAction } from './ui/gestures.ts'
import { useNow } from './ui/useNow.ts'

export interface AppProps {
  readonly initialTasks: readonly Task[]
}

export default function App({ initialTasks }: AppProps) {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(deckReducer, initialTasks, createDeckState)
  const now = useNow()
  const tasks = useMemo(() => orderDeck(state.present, now), [state.present, now])
  const top = tasks[0] ?? null

  const [flippedId, setFlippedId] = useState<string | null>(null)
  const [exiting, setExiting] = useState<Exiting | null>(null)
  const regionRef = useRef<HTMLElement>(null)
  const topCardRef = useRef<HTMLDivElement>(null)

  /** Gestures and buttons share this path: exit animation first, dispatch after. */
  function requestAction(action: SwipeAction) {
    if (top === null || exiting !== null) return
    setExiting({ id: top.id, action })
  }

  function finishAction(action: SwipeAction) {
    if (exiting === null) return
    dispatch({ type: action, id: exiting.id, now: new Date() })
    setExiting(null)
    setFlippedId(null)
  }

  function toggleFlip() {
    if (top === null) return
    setFlippedId((current) => (current === top.id ? null : top.id))
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.brand}>{t.app.name}</h1>
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
          regionRef={regionRef}
          topCardRef={topCardRef}
        />
      </main>
    </div>
  )
}
