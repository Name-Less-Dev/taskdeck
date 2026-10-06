import { describe, expect, it } from 'vitest'
import { EXIT_TIMEOUT_MS, exitReducer, IDLE, isExiting, shouldResetMotion, type ExitState } from '../../src/ui/exitState.ts'
import type { SwipeAction } from '../../src/ui/gestures.ts'

const exiting = (id = 'a', action: SwipeAction = 'complete', startedAt = 1000): ExitState => ({
  kind: 'exiting',
  id,
  action,
  startedAt,
})

describe('exitReducer: lock', () => {
  it('starts an exit for the top card', () => {
    expect(exitReducer(IDLE, { type: 'request', topId: 'a', action: 'postpone', at: 5 })).toEqual({
      state: { kind: 'exiting', id: 'a', action: 'postpone', startedAt: 5 },
      commit: null,
    })
  })

  it('blocks a second action while a card is exiting', () => {
    const state = exiting()

    const result = exitReducer(state, { type: 'request', topId: 'b', action: 'remove', at: 1100 })

    expect(result.state).toBe(state)
    expect(result.commit).toBeNull()
  })

  it('does nothing without a top card', () => {
    expect(exitReducer(IDLE, { type: 'request', topId: null, action: 'complete', at: 0 }).state).toBe(IDLE)
  })
})

describe('exitReducer: every exit ends in a commit', () => {
  it.each(['finished', 'interrupted'] as const)('a %s animation releases the lock and commits the action', (type) => {
    expect(exitReducer(exiting('a', 'remove'), { type, id: 'a' })).toEqual({
      state: IDLE,
      commit: { id: 'a', action: 'remove' },
    })
  })

  it.each(['finished', 'interrupted'] as const)('ignores a stale %s report about another card', (type) => {
    const state = exiting('a')

    expect(exitReducer(state, { type, id: 'b' })).toEqual({ state, commit: null })
    expect(exitReducer(IDLE, { type, id: 'a' })).toEqual({ state: IDLE, commit: null })
  })

  it(`commits on the safety-net timeout only after ${EXIT_TIMEOUT_MS} ms`, () => {
    const state = exiting('a', 'postpone', 1000)

    expect(exitReducer(state, { type: 'timeout', at: 1000 + EXIT_TIMEOUT_MS - 1 }).commit).toBeNull()
    expect(exitReducer(state, { type: 'timeout', at: 1000 + EXIT_TIMEOUT_MS })).toEqual({
      state: IDLE,
      commit: { id: 'a', action: 'postpone' },
    })
    expect(EXIT_TIMEOUT_MS).toBe(600)
  })

  it('a timeout with nothing exiting does nothing', () => {
    expect(exitReducer(IDLE, { type: 'timeout', at: 99_999 })).toEqual({ state: IDLE, commit: null })
  })
})

describe('exitReducer: a new top card starts clean', () => {
  it('after a commit, the next card exits with its own id, action and start time', () => {
    const ended = exitReducer(exiting('a', 'complete', 1000), { type: 'finished', id: 'a' }).state

    const next = exitReducer(ended, { type: 'request', topId: 'b', action: 'postpone', at: 2000 }).state

    expect(next).toEqual({ kind: 'exiting', id: 'b', action: 'postpone', startedAt: 2000 })
    // A late report about the previous card cannot end the new exit.
    expect(exitReducer(next, { type: 'finished', id: 'a' }).state).toBe(next)
  })

  it('narrows the state with isExiting', () => {
    expect(isExiting(IDLE)).toBe(false)
    expect(isExiting(exiting())).toBe(true)
  })
})

describe('shouldResetMotion', () => {
  it.each<[SwipeAction | null, SwipeAction | null, boolean]>([
    ['postpone', null, true],
    ['complete', null, true],
    ['remove', null, true],
    [null, null, false],
    [null, 'complete', false],
    ['complete', 'complete', false],
  ])('from exit %s to %s resets: %s', (previous, current, expected) => {
    expect(shouldResetMotion(previous, current)).toBe(expected)
  })
})
