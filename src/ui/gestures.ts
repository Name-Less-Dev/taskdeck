/**
 * Pure swipe decision for the top card. The drag library only reports what
 * happened (offset, velocity, card size); this module decides what it means,
 * so the rule is unit-tested without simulating pointer events.
 */

export type SwipeAction = 'complete' | 'postpone' | 'remove'

export interface Vector {
  readonly x: number
  readonly y: number
}

export interface SwipeInput {
  /** Distance from the drag origin, in px (right and down are positive). */
  readonly offset: Vector
  /** Pointer velocity at release, in px/s. */
  readonly velocity: Vector
  /** Rendered size of the card, in px. */
  readonly size: { readonly width: number; readonly height: number }
}

/** Horizontal swipes need at least this fraction of the card width. */
export const HORIZONTAL_DISTANCE_RATIO = 0.3

/** Upward swipes need at least this fraction of the card height. */
export const VERTICAL_DISTANCE_RATIO = 0.22

/** A release at least this fast (px/s) on the dominant axis counts as a flick... */
export const FLICK_VELOCITY = 500

/** ...as long as the card already moved this far (px) in that direction. */
export const FLICK_MIN_OFFSET = 40

/**
 * When |x| / |y| falls inside this range the gesture is too diagonal to tell
 * which axis the user meant, so nothing happens. 0.7 is close to 1 / 1.4, so
 * the dead zone is symmetric around 45 degrees.
 */
export const AMBIGUOUS_RATIO_MIN = 0.7
export const AMBIGUOUS_RATIO_MAX = 1.4

function passes(offset: number, velocity: number, distanceThreshold: number): boolean {
  const magnitude = Math.abs(offset)
  if (distanceThreshold > 0 && magnitude >= distanceThreshold) return true
  // A flick must go the same way as the card moved; flicking back cancels.
  const sameDirection = Math.sign(velocity) === Math.sign(offset)
  return magnitude >= FLICK_MIN_OFFSET && sameDirection && Math.abs(velocity) >= FLICK_VELOCITY
}

/**
 * Right = complete, left = postpone, up = remove, down or undecided = null.
 * A swipe is accepted by distance (30% of the width / 22% of the height) or
 * by a flick (>= 500 px/s with at least 40 px of travel). A non-positive
 * size disables the distance rule; flicks still work.
 */
export function decideSwipe({ offset, velocity, size }: SwipeInput): SwipeAction | null {
  const absX = Math.abs(offset.x)
  const absY = Math.abs(offset.y)
  if (absX === 0 && absY === 0) return null

  const ratio = absY === 0 ? Number.POSITIVE_INFINITY : absX / absY
  if (ratio >= AMBIGUOUS_RATIO_MIN && ratio <= AMBIGUOUS_RATIO_MAX) return null

  if (absX > absY) {
    if (!passes(offset.x, velocity.x, size.width * HORIZONTAL_DISTANCE_RATIO)) return null
    return offset.x > 0 ? 'complete' : 'postpone'
  }

  if (offset.y > 0) return null
  return passes(offset.y, velocity.y, size.height * VERTICAL_DISTANCE_RATIO) ? 'remove' : null
}
