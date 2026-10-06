import { createContext, useContext } from 'react'

/** Service worker and install state, as the app sees it. */
export interface PwaState {
  /** A new version is installed and waiting for "Update". */
  readonly needRefresh: boolean
  /** Activates the waiting version and reloads. Only ever called from a click. */
  readonly update: () => void
  /** A service worker is active, so the precached app opens offline. */
  readonly offlineReady: boolean
  /** The browser offered an install prompt that can be shown now. */
  readonly canPrompt: boolean
  readonly install: () => void
  readonly isIos: boolean
  readonly standalone: boolean
}

/** Default for tests and the dev server: no service worker, nothing to install. */
export const NO_PWA: PwaState = {
  needRefresh: false,
  update: () => undefined,
  offlineReady: false,
  canPrompt: false,
  install: () => undefined,
  isIos: false,
  standalone: false,
}

export const PwaContext = createContext<PwaState>(NO_PWA)

export function usePwa(): PwaState {
  return useContext(PwaContext)
}
