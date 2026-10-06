/** What Settings offers to install the app. */
export type InstallUi = 'prompt' | 'ios-hint' | 'none'

export interface InstallUiInput {
  /** A `beforeinstallprompt` event was captured (Chromium) and not used yet. */
  readonly canPrompt: boolean
  /** iOS Safari: no install event, only "Share > Add to Home Screen". */
  readonly isIos: boolean
  /** Already running as an installed app. */
  readonly standalone: boolean
  /** The iOS hint was dismissed (persisted in settings). */
  readonly dismissed: boolean
}

/**
 * Installed apps show nothing; Chromium gets an "Install app" button while it
 * offers the prompt; iOS Safari gets a dismissible hint; anything else (e.g.
 * Firefox desktop, or Chromium after the prompt was used) gets nothing.
 */
export function decideInstallUi({ canPrompt, isIos, standalone, dismissed }: InstallUiInput): InstallUi {
  if (standalone) return 'none'
  if (canPrompt) return 'prompt'
  if (isIos && !dismissed) return 'ios-hint'
  return 'none'
}

/**
 * iOS (or iPadOS, which reports itself as a Mac with touch) in Safari. Other
 * iOS browsers (CriOS, FxiOS, EdgiOS) are left out: their menus differ.
 */
export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  return ios && /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS/.test(userAgent)
}
