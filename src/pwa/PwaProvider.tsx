import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { PwaContext, type PwaState } from './context.ts'
import { isIosSafari } from './install.ts'

/** Chromium's install event (not in the DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<unknown>
}

function isInstallEvent(event: Event): event is BeforeInstallPromptEvent {
  return 'prompt' in event && typeof event.prompt === 'function'
}

// The event can fire before React mounts, so it is captured at module load.
let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
function setDeferredPrompt(event: BeforeInstallPromptEvent | null) {
  deferredPrompt = event
  for (const listener of listeners) listener()
}
window.addEventListener('beforeinstallprompt', (event) => {
  if (!isInstallEvent(event)) return
  // Keep the browser's mini-infobar away: the app offers it in Settings.
  event.preventDefault()
  setDeferredPrompt(event)
})
window.addEventListener('appinstalled', () => {
  setDeferredPrompt(null)
})
function subscribePrompt(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const STANDALONE_QUERY = '(display-mode: standalone)'

function isStandalone(): boolean {
  // navigator.standalone is iOS Safari's own flag.
  const iosStandalone = 'standalone' in navigator && navigator.standalone === true
  return window.matchMedia(STANDALONE_QUERY).matches || iosStandalone
}

function subscribeStandalone(listener: () => void) {
  const query = window.matchMedia(STANDALONE_QUERY)
  query.addEventListener('change', listener)
  return () => {
    query.removeEventListener('change', listener)
  }
}

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
  const canPrompt = useSyncExternalStore(subscribePrompt, () => deferredPrompt !== null)
  const standalone = useSyncExternalStore(subscribeStandalone, isStandalone)
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
      canPrompt,
      install: () => {
        const event = deferredPrompt
        if (event === null) return
        // A prompt can be shown only once.
        setDeferredPrompt(null)
        void event.prompt()
      },
      isIos: isIosSafari(navigator.userAgent, navigator.maxTouchPoints),
      standalone,
    }),
    [needRefresh, updateServiceWorker, offlineReady, canPrompt, standalone],
  )

  return <PwaContext value={value}>{children}</PwaContext>
}
