import { describe, expect, it } from 'vitest'
import { completeTask, snoozeTask, type Task } from '../../src/domain/index.ts'
import { rolloverStep } from '../../src/ui/rollover.ts'
import { makeTask, NOW } from '../domain/fixtures.ts'

function weekly(id: string, date: string): Task {
  return makeTask({ id, due: { date }, recurrence: { unit: 'week', every: 1, anchor: 'due' } })
}

const tasks = [weekly('tomorrow', '2026-10-06'), weekly('in-two-days', '2026-10-07'), makeTask({ id: 'one-off' })]

describe('rolloverStep', () => {
  it('announces nothing on the first call (initial load)', () => {
    expect(rolloverStep(null, tasks, NOW).appeared).toBe(0)
  })

  it('counts the cards that woke up when the local day changes', () => {
    const { state } = rolloverStep(null, tasks, NOW)

    expect(rolloverStep(state, tasks, new Date(2026, 9, 5, 23, 59)).appeared).toBe(0)
    const midnight = rolloverStep(state, tasks, new Date(2026, 9, 6, 0, 0))
    expect(midnight.appeared).toBe(1)
    // Each card is counted once: the next tick on the same day says nothing.
    expect(rolloverStep(midnight.state, tasks, new Date(2026, 9, 6, 0, 0, 30)).appeared).toBe(0)
  })

  it('counts every card woken by a jump of several days (tab back after a while)', () => {
    const { state } = rolloverStep(null, tasks, NOW)

    expect(rolloverStep(state, tasks, new Date(2026, 9, 8, 9, 0)).appeared).toBe(2)
  })

  it('does not count a card that became dormant and available on the same day (complete, then undo)', () => {
    const today = weekly('today', '2026-10-05')
    const first = rolloverStep(null, [today], NOW)
    const completed = rolloverStep(first.state, [completeTask(today, NOW)], NOW)

    expect(completed.state.waitingIds.has('today')).toBe(true)
    expect(rolloverStep(completed.state, [today], NOW).appeared).toBe(0)
  })
})

describe('rolloverStep with snoozed cards', () => {
  it('counts a card snoozed yesterday when it comes back', () => {
    const snoozed = snoozeTask(makeTask({ id: 's' }), NOW)
    const { state } = rolloverStep(null, [snoozed], NOW)

    expect(rolloverStep(state, [snoozed], new Date(2026, 9, 6, 0, 0, 10)).appeared).toBe(1)
  })
})
