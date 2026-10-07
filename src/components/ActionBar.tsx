import { useI18n } from '../i18n/index.tsx'
import type { SwipeAction } from '../ui/gestures.ts'
import styles from './ActionBar.module.css'
import { Icon, type IconName } from './Icon.tsx'

const BUTTONS: readonly { action: SwipeAction; icon: IconName }[] = [
  { action: 'postpone', icon: 'clock' },
  { action: 'snooze', icon: 'moon' },
  { action: 'remove', icon: 'trash' },
  { action: 'complete', icon: 'check' },
]

export interface ActionBarProps {
  readonly disabled: boolean
  readonly onAction: (action: SwipeAction) => void
}

/** Button alternative to the swipe gestures, in the thumb zone. */
export function ActionBar({ disabled, onAction }: ActionBarProps) {
  const { t } = useI18n()
  const keys = t.shortcuts

  return (
    <footer className={styles.bar}>
      <div className={styles.buttons} role="group" aria-label={t.actions.actionsLabel}>
        {BUTTONS.map(({ action, icon }) => (
          <button
            key={action}
            type="button"
            className={styles.button}
            data-action={action}
            disabled={disabled}
            onClick={() => {
              onAction(action)
            }}
          >
            <Icon name={icon} size={24} />
            <span>{t.actions[action]}</span>
          </button>
        ))}
      </div>

      <details className={styles.shortcuts}>
        <summary>{keys.summary}</summary>
        <dl>
          <dt>
            <kbd>Enter</kbd> / <kbd>{keys.spaceKey}</kbd>
          </dt>
          <dd>{keys.flip}</dd>
          <dt>
            <kbd>→</kbd>
          </dt>
          <dd>{keys.complete}</dd>
          <dt>
            <kbd>←</kbd>
          </dt>
          <dd>{keys.postpone}</dd>
          <dt>
            <kbd>↓</kbd>
          </dt>
          <dd>{keys.snooze}</dd>
          <dt>
            <kbd>Delete</kbd> / <kbd>Backspace</kbd>
          </dt>
          <dd>{keys.remove}</dd>
          <dt>
            <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Z</kbd>
          </dt>
          <dd>{keys.undo}</dd>
          <dt>
            <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> / <kbd>Ctrl</kbd> + <kbd>Y</kbd>
          </dt>
          <dd>{keys.redo}</dd>
        </dl>
      </details>
    </footer>
  )
}
