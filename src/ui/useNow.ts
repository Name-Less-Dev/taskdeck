import { useEffect, useState } from 'react'

export const DEFAULT_NOW_INTERVAL_MS = 30_000

/**
 * The current time for rendering, refreshed every `intervalMs` and whenever
 * the tab becomes visible again (timers are throttled in background tabs).
 * Due badges derive from it, so they update on their own.
 */
export function useNow(intervalMs: number = DEFAULT_NOW_INTERVAL_MS): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = () => {
      setNow(new Date())
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') tick()
    }

    const timer = setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [intervalMs])

  return now
}
