// Imported first by main.tsx so it catches errors thrown while the other
// modules load. `import.meta.env.DEV` is false in production builds, so this
// branch and the overlay code are dropped from the bundle.
import { installErrorOverlay } from './errorOverlay.ts'
import { installGesturePanel } from './gestureDebug.ts'

if (import.meta.env.DEV) {
  installErrorOverlay()
  // ?debug=gestures shows the gesture/viewport panel (see gestureDebug.ts).
  if (new URLSearchParams(window.location.search).get('debug') === 'gestures') installGesturePanel()
}
