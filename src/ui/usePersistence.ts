import { useCallback, useEffect, useRef, useState } from 'react'
import { getPersistence, requestPersistence, type PersistenceState } from '../storage/index.ts'

export interface PersistenceApi {
  readonly get: () => Promise<PersistenceState>
  readonly request: () => Promise<PersistenceState>
}

export const browserPersistence: PersistenceApi = {
  get: () => getPersistence(),
  request: () => requestPersistence(),
}

/**
 * Persistent-storage status for the settings screen, plus `requestOnce`,
 * called after the first user action (browsers want a user gesture and it
 * is pointless before there is any data worth keeping).
 */
export function usePersistence(api: PersistenceApi, enabled: boolean) {
  const [state, setState] = useState<PersistenceState | null>(null)
  const requested = useRef(false)

  useEffect(() => {
    let alive = true
    void api.get().then((result) => {
      if (alive) setState(result)
    })
    return () => {
      alive = false
    }
  }, [api])

  const requestOnce = useCallback(() => {
    if (!enabled || requested.current) return
    requested.current = true
    void api.request().then(setState)
  }, [api, enabled])

  return { state, requestOnce }
}
