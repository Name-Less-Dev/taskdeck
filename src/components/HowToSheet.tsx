import { useRef, useState } from 'react'
import type { SwipeAction } from '../ui/gestures.ts'
import { useI18n } from '../i18n/index.tsx'
import { useFinePointer } from '../ui/useFinePointer.ts'
import form from './Form.module.css'
import styles from './HowToSheet.module.css'
import { HowToIllustration } from './HowToIllustration.tsx'
import { PracticeDeck } from './PracticeDeck.tsx'
import { AUTOFOCUS_ATTRIBUTE, Sheet } from './Sheet.tsx'

export const HOW_TO_STEP_COUNT = 5

/** How the sheet was left; every one of them marks the tutorial as seen. */
export type HowToCloseReason = 'closed' | 'skipped' | 'finished'

export interface HowToSheetProps {
  readonly onClose: (reason: HowToCloseReason) => void
  /** Steps 2 and 3 are exercises on a practice deck (false: static figures only). */
  readonly practice?: boolean
}

/** Exercises per step (0-based): sideways, then up and down. */
const PRACTICE: Readonly<Partial<Record<number, readonly SwipeAction[]>>> = {
  1: ['complete', 'postpone'],
  2: ['snooze', 'remove'],
}

/**
 * "How to use": five short steps with a static illustration each (tokens
 * only, directions always as arrow + text); steps 2 and 3 are exercises on
 * an isolated practice deck instead (PracticeDeck), Back / Next (Finish on the last)
 * and Skip. Never opened automatically. Each step change is announced in the
 * sheet's own live region; there is no time limit and nothing moves.
 */
export function HowToSheet({ onClose, practice = true }: HowToSheetProps) {
  const { t } = useI18n()
  const finePointer = useFinePointer()
  const [step, setStep] = useState(0)
  const [announcement, setAnnouncement] = useState<{ id: number; text: string } | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const content = t.howTo.steps[step] ?? { title: '', body: '' }
  const last = step === HOW_TO_STEP_COUNT - 1
  const exercises = practice ? PRACTICE[step] : undefined

  function go(next: number) {
    const target = t.howTo.steps[next]
    if (target === undefined) return
    setStep(next)
    setAnnouncement((current) => ({ id: (current?.id ?? 0) + 1, text: t.howTo.announce(next + 1, HOW_TO_STEP_COUNT, target.title) }))
    // "Back" disappears on the first step, and a finished practice card is gone:
    // keep focus on a control that stays.
    if (next === 0 || PRACTICE[step] !== undefined) nextRef.current?.focus()
  }

  return (
    <Sheet
      title={t.howTo.title}
      onClose={() => {
        onClose('closed')
      }}
    >
      <div className={styles.body}>
        <p className={styles.progress} data-testid="how-to-progress">
          {t.howTo.stepOf(step + 1, HOW_TO_STEP_COUNT)}
        </p>
        <h3 className={styles.title}>{content.title}</h3>
        <p className={styles.text}>{content.body}</p>
        {step === 3 && finePointer && <p className={styles.text}>{t.howTo.keyboardHint}</p>}

        <div className={styles.stage}>
          {exercises === undefined ? (
            <HowToIllustration step={step} />
          ) : (
            <PracticeDeck
              // A new practice for every visit to the step.
              key={step}
              exercises={exercises}
              onComplete={() => {
                go(step + 1)
              }}
              onSkip={() => {
                go(step + 1)
              }}
            />
          )}
        </div>

        <div className={styles.nav}>
          <button
            type="button"
            className={styles.skip}
            onClick={() => {
              onClose('skipped')
            }}
          >
            {t.howTo.skip}
          </button>
          <div className={styles.navMain}>
            {step > 0 && (
              <button
                type="button"
                className={form.secondary}
                onClick={() => {
                  go(step - 1)
                }}
              >
                {t.howTo.back}
              </button>
            )}
            <button
              ref={nextRef}
              type="button"
              className={form.primary}
              {...{ [AUTOFOCUS_ATTRIBUTE]: true }}
              onClick={() => {
                if (last) onClose('finished')
                else go(step + 1)
              }}
            >
              {last ? t.howTo.finish : t.howTo.next}
            </button>
          </div>
        </div>

        <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true" data-testid="how-to-live">
          {announcement !== null && <span key={announcement.id}>{announcement.text}</span>}
        </div>
      </div>
    </Sheet>
  )
}
