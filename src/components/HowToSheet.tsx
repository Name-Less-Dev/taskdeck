import { useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { useFinePointer } from '../ui/useFinePointer.ts'
import form from './Form.module.css'
import styles from './HowToSheet.module.css'
import { HowToIllustration } from './HowToIllustration.tsx'
import { AUTOFOCUS_ATTRIBUTE, Sheet } from './Sheet.tsx'

export const HOW_TO_STEP_COUNT = 5

/** How the sheet was left; every one of them marks the tutorial as seen. */
export type HowToCloseReason = 'closed' | 'skipped' | 'finished'

export interface HowToSheetProps {
  readonly onClose: (reason: HowToCloseReason) => void
  /**
   * Replaces a step's illustration with something interactive (the practice
   * deck). Receives the 0-based step index; undefined keeps the illustration.
   */
  readonly renderPractice?: (step: number) => ReactNode | undefined
}

/**
 * "How to use": five short steps with a static illustration each (tokens
 * only, directions always as arrow + text), Back / Next (Finish on the last)
 * and Skip. Never opened automatically. Each step change is announced in the
 * sheet's own live region; there is no time limit and nothing moves.
 */
export function HowToSheet({ onClose, renderPractice }: HowToSheetProps) {
  const { t } = useI18n()
  const finePointer = useFinePointer()
  const [step, setStep] = useState(0)
  const [announcement, setAnnouncement] = useState<{ id: number; text: string } | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const content = t.howTo.steps[step] ?? { title: '', body: '' }
  const last = step === HOW_TO_STEP_COUNT - 1
  const practice = renderPractice?.(step)

  function go(next: number) {
    const target = t.howTo.steps[next]
    if (target === undefined) return
    setStep(next)
    setAnnouncement((current) => ({ id: (current?.id ?? 0) + 1, text: t.howTo.announce(next + 1, HOW_TO_STEP_COUNT, target.title) }))
    // "Back" disappears on the first step: keep focus on a control that stays.
    if (next === 0) nextRef.current?.focus()
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

        <div className={styles.stage}>{practice ?? <HowToIllustration step={step} />}</div>

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

        <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
          {announcement !== null && <span key={announcement.id}>{announcement.text}</span>}
        </div>
      </div>
    </Sheet>
  )
}
