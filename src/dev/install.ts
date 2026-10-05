// Imported first by main.tsx so it catches errors thrown while the other
// modules load. `import.meta.env.DEV` is false in production builds, so this
// branch and the overlay code are dropped from the bundle.
import { installErrorOverlay } from './errorOverlay.ts'

if (import.meta.env.DEV) installErrorOverlay()
