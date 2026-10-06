import type { SwipeAction } from './gestures.ts'

/**
 * Pure state machine for "animate the top card out, then apply the action".
 * While a card is exiting, new actions are blocked; the exit always ends in
 * a commit, whether the animation finished, was interrupted (the card lost
 * the top or was unmounted) or never reported back (safety-net timeout).
 */

/** Safety net: an exit that has not reported back after this long is committed anyway. */
export const EXIT_TIMEOUT_MS = 600

export type ExitState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'exiting'; readonly id: string; readonly action: SwipeAction; readonly startedAt: number }

export type ExitEvent =
  | { readonly type: 'request'; readonly topId: string | null; readonly action: SwipeAction; readonly at: number }
  | { readonly type: 'finished'; readonly id: string }
  | { readonly type: 'interrupted'; readonly id: string }
  | { readonly type: 'timeout'; readonly at: number }

export interface ExitTransition {
  readonly state: ExitState
  /** The action to apply now, if the exit ended. */
  readonly commit: { readonly id: string; readonly action: SwipeAction } | null
}

export const IDLE: ExitState = { kind: 'idle' }

function end(state: Extract<ExitState, { kind: 'exiting' }>): ExitTransition {
  return { state: IDLE, commit: { id: state.id, action: state.action } }
}

export function exitReducer(state: ExitState, event: ExitEvent): ExitTransition {
  const unchanged = { state, commit: null }
  switch (event.type) {
    case 'request':
      if (state.kind === 'exiting' || event.topId === null) return unchanged
      return { state: { kind: 'exiting', id: event.topId, action: event.action, startedAt: event.at }, commit: null }
    case 'finished':
    case 'interrupted':
      // Reports about another card (or after the exit ended) are stale.
      return state.kind === 'exiting' && state.id === event.id ? end(state) : unchanged
    case 'timeout':
      return state.kind === 'exiting' && event.at - state.startedAt >= EXIT_TIMEOUT_MS ? end(state) : unchanged
  }
}

export function isExiting(state: ExitState): state is Extract<ExitState, { kind: 'exiting' }> {
  return state.kind === 'exiting'
}

/**
 * A card's motion values (x, y, opacity) must return to the origin when its
 * exit ends while the card stays mounted: a postponed or recurring task is
 * the same card (same key) further down the deck, and would otherwise come
 * back off-screen and transparent.
 */
export function shouldResetMotion(previousExit: SwipeAction | null, exit: SwipeAction | null): boolean {
  return previousExit !== null && exit === null
}
