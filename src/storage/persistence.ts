/**
 * Persistent storage asks the browser not to evict our data under storage
 * pressure. navigator.storage only exists in secure contexts (HTTPS or
 * localhost), so on http://<LAN IP> it is reported as unsupported.
 */
export interface PersistenceState {
  readonly supported: boolean
  readonly persisted: boolean
}

/** The part of StorageManager used here; every member may be missing. */
export interface StorageManagerLike {
  readonly persist?: () => Promise<boolean>
  readonly persisted?: () => Promise<boolean>
}

export interface NavigatorLike {
  readonly storage?: StorageManagerLike
}

const UNSUPPORTED: PersistenceState = { supported: false, persisted: false }

function currentNavigator(): NavigatorLike {
  return typeof navigator === 'undefined' ? {} : navigator
}

/** Current state without asking the user for anything. */
export async function getPersistence(nav: NavigatorLike = currentNavigator()): Promise<PersistenceState> {
  const persisted = nav.storage?.persisted
  if (typeof persisted !== 'function') return UNSUPPORTED
  try {
    return { supported: true, persisted: await persisted.call(nav.storage) }
  } catch {
    return { supported: true, persisted: false }
  }
}

/** Asks for persistent storage; call it after a user action. Never throws. */
export async function requestPersistence(nav: NavigatorLike = currentNavigator()): Promise<PersistenceState> {
  const persist = nav.storage?.persist
  if (typeof persist !== 'function') return UNSUPPORTED
  try {
    return { supported: true, persisted: await persist.call(nav.storage) }
  } catch {
    return { supported: true, persisted: false }
  }
}
