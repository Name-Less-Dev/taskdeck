import type { SwipeAction } from './gestures.ts'

/**
 * The card action a key stands for (no modifiers): → complete, ← later,
 * ↓ tomorrow, Delete/Backspace delete. Shared by the real deck and the
 * how-to practice deck, so both answer the same keys.
 */
export function swipeActionForKey(key: string): SwipeAction | null {
  switch (key) {
    case 'ArrowRight':
      return 'complete'
    case 'ArrowLeft':
      return 'postpone'
    case 'ArrowDown':
      return 'snooze'
    case 'Delete':
    case 'Backspace':
      return 'remove'
    default:
      return null
  }
}
