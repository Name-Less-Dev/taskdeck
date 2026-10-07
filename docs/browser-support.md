# Browser support

[← Back to the README](../README.md)

## Browser support

The build uses Vite 8's default target (Chrome/Edge 111, Firefox 114, Safari/iOS 16.4).
Vite down-compiles syntax but does not polyfill APIs or CSS. Newer features in use:

| Feature | Where | Notes |
| --- | --- | --- |
| `crypto.randomUUID` | `src/lib/id.ts` only | Secure contexts only; falls back to `getRandomValues` |
| `navigator.storage.persist` | persistence status | Secure contexts only; reported as unavailable otherwise |
| IndexedDB | storage | Falls back to memory when it cannot be opened |
| `Array.prototype.with` | `domain/actions.ts` (`upsertTask`) | Firefox 115+, one version above the target |
| `Array.prototype.at` | sheet focus trap | Safari 15.4+, Firefox 90+ |
| `inert` attribute | stacked cards, page behind sheets | Safari 15.5+, Firefox 112+; also backed by `aria-hidden`/`tabIndex` |
| CSS `:has()` | selected priority in the form | **Firefox 121+**: on 114-120 the selected option is not highlighted |
| CSS `dvh` units | app shell, card, sheets | Each preceded by a `vh` fallback |
| `structuredClone` | memory storage | Chrome 98+, Safari 15.4+, Firefox 94+ |
| `Blob.text()` | backup import | Widely available |
| Service worker, Web App Manifest | PWA | Secure contexts only (HTTPS, localhost); none in `npm run dev` |
| `beforeinstallprompt` | "Install app" | Chromium only; iOS Safari gets a hint, Firefox nothing |
| `display-mode: standalone`, `navigator.standalone` | hide install UI when installed | `navigator.standalone` is iOS only |
