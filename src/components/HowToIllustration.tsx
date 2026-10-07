import { useI18n } from '../i18n/index.tsx'
import styles from './HowToSheet.module.css'

/**
 * Static illustrations for the how-to steps, drawn with HTML/CSS and the
 * colour tokens (so every theme works and contrast is covered by the token
 * tests). Every direction is an arrow AND a word. Decorative: the step text
 * says the same, so it is hidden from assistive technology.
 */
export function HowToIllustration({ step }: { step: number }) {
  const { t } = useI18n()

  switch (step) {
    case 0:
      return (
        <div className={styles.figure} aria-hidden="true" data-testid="how-to-figure">
          <div className={styles.stack}>
            <div className={styles.miniCard} data-depth="2" />
            <div className={styles.miniCard} data-depth="1" />
            <div className={styles.miniCard} data-depth="0">
              <span className={styles.miniTitle}>{t.howTo.figure.card}</span>
              <span className={styles.miniHint}>{t.card.flipHint}</span>
            </div>
          </div>
        </div>
      )
    case 1:
      return (
        <div className={styles.figure} aria-hidden="true" data-testid="how-to-figure">
          <div className={styles.cross}>
            <span className={styles.arrow} data-direction="left">
              ← {t.actions.postpone}
            </span>
            <div className={styles.miniCard} data-depth="0">
              <span className={styles.miniTitle}>{t.howTo.figure.card}</span>
            </div>
            <span className={styles.arrow} data-direction="right">
              {t.actions.complete} →
            </span>
          </div>
        </div>
      )
    case 2:
      return (
        <div className={styles.figure} aria-hidden="true" data-testid="how-to-figure">
          <div className={styles.column}>
            <span className={styles.arrow} data-direction="up">
              ↑ {t.actions.remove}
            </span>
            <div className={styles.miniCard} data-depth="0">
              <span className={styles.miniTitle}>{t.howTo.figure.card}</span>
            </div>
            <span className={styles.arrow} data-direction="down">
              ↓ {t.actions.snooze}
            </span>
          </div>
        </div>
      )
    case 3:
      return (
        <div className={styles.figure} aria-hidden="true" data-testid="how-to-figure">
          <div className={styles.miniBar}>
            <span>← {t.actions.postpone}</span>
            <span>↓ {t.actions.snooze}</span>
            <span>↑ {t.actions.remove}</span>
            <span data-primary>{t.actions.complete} →</span>
          </div>
        </div>
      )
    default:
      return (
        <div className={styles.figure} aria-hidden="true" data-testid="how-to-figure">
          <div className={styles.chips}>
            <span className={styles.chip}>{t.howTo.figure.scheduled}</span>
            <span className={styles.chip}>↶ {t.actions.undo}</span>
            <span className={styles.chip}>{t.howTo.figure.backup}</span>
          </div>
        </div>
      )
  }
}
