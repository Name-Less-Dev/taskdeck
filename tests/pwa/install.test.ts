import { describe, expect, it } from 'vitest'
import { decideInstallUi, isIosSafari, type InstallUi } from '../../src/pwa/install.ts'

describe('decideInstallUi', () => {
  it.each<[canPrompt: boolean, isIos: boolean, standalone: boolean, dismissed: boolean, expected: InstallUi]>([
    // Installed: never offer anything.
    [true, false, true, false, 'none'],
    [false, true, true, false, 'none'],
    [false, true, true, true, 'none'],
    // Chromium with a captured beforeinstallprompt.
    [true, false, false, false, 'prompt'],
    [true, false, false, true, 'prompt'],
    // iOS Safari: the hint, until dismissed.
    [false, true, false, false, 'ios-hint'],
    [false, true, false, true, 'none'],
    // Neither (Firefox desktop, prompt already used, unsupported browser).
    [false, false, false, false, 'none'],
    [false, false, false, true, 'none'],
  ])('canPrompt=%s isIos=%s standalone=%s dismissed=%s -> %s', (canPrompt, isIos, standalone, dismissed, expected) => {
    expect(decideInstallUi({ canPrompt, isIos, standalone, dismissed })).toBe(expected)
  })
})

describe('isIosSafari', () => {
  const IPHONE_SAFARI =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  const MAC_SAFARI =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
  const IPHONE_CHROME =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1'
  const ANDROID_CHROME =
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'

  it.each([
    ['iPhone Safari', IPHONE_SAFARI, 5, true],
    ['iPad Safari (reports a Mac with touch)', MAC_SAFARI, 5, true],
    ['Mac Safari (no touch)', MAC_SAFARI, 0, false],
    ['Chrome on iPhone', IPHONE_CHROME, 5, false],
    ['Chrome on Android', ANDROID_CHROME, 5, false],
  ])('%s -> %s', (_name, userAgent, touchPoints, expected) => {
    expect(isIosSafari(userAgent, touchPoints)).toBe(expected)
  })
})
