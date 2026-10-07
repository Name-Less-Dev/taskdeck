import { describe, expect, it } from 'vitest'
import {
  AMBIGUOUS_RATIO_MAX,
  AMBIGUOUS_RATIO_MIN,
  decideSwipe,
  FLICK_MIN_OFFSET,
  FLICK_VELOCITY,
  HORIZONTAL_DISTANCE_RATIO,
  VERTICAL_DISTANCE_RATIO,
  type SwipeAction,
} from '../../src/ui/gestures.ts'

// A 400 x 500 card: horizontal threshold 120 px, vertical threshold 110 px.
const size = { width: 400, height: 500 }
const still = { x: 0, y: 0 }

type Row = [label: string, offset: { x: number; y: number }, velocity: { x: number; y: number }, expected: SwipeAction | null]

describe('decideSwipe', () => {
  it('exposes the documented thresholds', () => {
    expect([HORIZONTAL_DISTANCE_RATIO, VERTICAL_DISTANCE_RATIO]).toEqual([0.3, 0.22])
    expect([FLICK_VELOCITY, FLICK_MIN_OFFSET]).toEqual([500, 40])
    expect([AMBIGUOUS_RATIO_MIN, AMBIGUOUS_RATIO_MAX]).toEqual([0.7, 1.4])
  })

  it.each<Row>([
    // By distance
    ['right at exactly 30% of the width', { x: 120, y: 0 }, still, 'complete'],
    ['left at exactly 30% of the width', { x: -120, y: 10 }, still, 'postpone'],
    ['up at exactly 22% of the height', { x: 5, y: -110 }, still, 'remove'],
    ['right far beyond the threshold', { x: 300, y: 40 }, still, 'complete'],
    // By velocity (flick)
    ['a fast flick to the right', { x: 40, y: 0 }, { x: 500, y: 0 }, 'complete'],
    ['a fast flick to the left', { x: -60, y: 5 }, { x: -900, y: 0 }, 'postpone'],
    ['a fast flick upwards', { x: 0, y: -45 }, { x: 0, y: -800 }, 'remove'],
    // Below the limits
    ['right just under the distance threshold, slow', { x: 119, y: 0 }, { x: 100, y: 0 }, null],
    ['up just under the distance threshold, slow', { x: 0, y: -109 }, still, null],
    ['a fast flick that moved less than 40 px', { x: 39, y: 0 }, { x: 2000, y: 0 }, null],
    ['a flick just under 500 px/s', { x: 60, y: 0 }, { x: 499, y: 0 }, null],
    ['a flick going back against the drag', { x: 80, y: 0 }, { x: -900, y: 0 }, null],
    // Ambiguous diagonal
    ['a 45-degree diagonal', { x: 200, y: -200 }, { x: 900, y: -900 }, null],
    ['a diagonal at the lower edge of the dead zone (0.7)', { x: 140, y: -200 }, still, null],
    ['a diagonal at the upper edge of the dead zone (1.4)', { x: 280, y: -200 }, still, null],
    ['just outside the dead zone, horizontal wins', { x: 290, y: -200 }, still, 'complete'],
    ['just outside the dead zone, vertical wins', { x: -130, y: -200 }, still, 'remove'],
    // Downwards: snooze ("Tomorrow"), same thresholds as up
    ['down by a long distance', { x: 0, y: 300 }, still, 'snooze'],
    ['down at exactly 22% of the height', { x: 5, y: 110 }, still, 'snooze'],
    ['down just under the distance threshold, slow', { x: 0, y: 109 }, still, null],
    ['a fast flick downwards', { x: 0, y: 100 }, { x: 0, y: 2000 }, 'snooze'],
    ['a downward flick at exactly 500 px/s and 40 px', { x: 0, y: 40 }, { x: 0, y: 500 }, 'snooze'],
    ['a downward flick that moved less than 40 px', { x: 0, y: 39 }, { x: 0, y: 2000 }, null],
    ['a downward flick just under 500 px/s', { x: 0, y: 60 }, { x: 0, y: 499 }, null],
    ['a flick up while dragged down cancels', { x: 0, y: 80 }, { x: 0, y: -900 }, null],
    ['a 45-degree diagonal downwards', { x: -200, y: 200 }, { x: -900, y: 900 }, null],
    ['just outside the dead zone downwards, vertical wins', { x: 130, y: 200 }, still, 'snooze'],
    // Zero values
    ['no movement at all', { x: 0, y: 0 }, still, null],
    ['no movement with velocity noise', { x: 0, y: 0 }, { x: 900, y: 0 }, null],
  ])('%s', (_label, offset, velocity, expected) => {
    expect(decideSwipe({ offset, velocity, size })).toBe(expected)
  })

  it('ignores the distance rule for a zero-sized card but still accepts flicks', () => {
    const zero = { width: 0, height: 0 }

    expect(decideSwipe({ offset: { x: 300, y: 0 }, velocity: still, size: zero })).toBeNull()
    expect(decideSwipe({ offset: { x: 50, y: 0 }, velocity: { x: 600, y: 0 }, size: zero })).toBe('complete')
  })
})
