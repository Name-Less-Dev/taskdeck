import { useCallback, useEffect, useRef, useState } from 'react'
import type { Task } from '../domain/index.ts'
import { INITIAL_REMINDERS, reminderStep, type Reminder } from './reminders.ts'

export interface ReminderNotice {
  /** Changes for every reminder so the UI can restart its timer and announce it. */
  readonly id: number
  readonly reminder: Reminder
}

/**
 * Watches every task's urgency band as `now` ticks (useNow refreshes every
 * 30 s and when the tab becomes visible) and produces in-app reminders by
 * the rules in reminders.ts. Only works while the app is open.
 */
export function useDueReminders(tasks: readonly Task[], now: Date) {
  const state = useRef(INITIAL_REMINDERS)
  const counter = useRef(0)
  const [notice, setNotice] = useState<ReminderNotice | null>(null)

  useEffect(() => {
    const visible = document.visibilityState !== 'hidden'
    const result = reminderStep(state.current, tasks, now, visible)
    state.current = result.state
    if (result.reminder !== null) {
      counter.current += 1
      setNotice({ id: counter.current, reminder: result.reminder })
    }
  }, [tasks, now])

  const dismiss = useCallback(() => {
    setNotice(null)
  }, [])

  return { notice, dismiss }
}
