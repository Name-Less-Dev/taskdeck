import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { PwaContext, type PwaState } from './context.ts'

/**
 * Registers the service worker (production build only; vite-plugin-pwa
 * leaves it off in dev) with registerType "prompt": a new version waits
 * until the user chooses "Update". Never reloads on its own.
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const [offlineReady, setOfflineReady] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let alive = true
    // Resolves once a worker is active, i.e. after its install step finished
    // the precache. Stays pending forever when there is no worker (dev).
    void navigator.serviceWorker.ready.then((registration) => {
      if (alive && registration.active !== null) setOfflineReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  const value = useMemo<PwaState>(
    () => ({
      needRefresh,
      update: () => {
        void updateServiceWorker(true)
      },
      offlineReady,
    }),
    [needRefresh, updateServiceWorker, offlineReady],
  )

  return <PwaContext value={value}>{children}</PwaContext>
}
