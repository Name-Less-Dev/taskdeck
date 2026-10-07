# Testing and development

[← Back to the README](../README.md)

## Scripts

Requires Node 24+ and npm.

```bash
npm install
npm run dev            # Vite dev server (add -- --host to open it from a phone)
npm test               # Vitest, once (node + jsdom projects)
npm run test:watch     # Vitest in watch mode
npm run test:coverage  # V8 coverage (fails under 90% lines in domain, state or storage)
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit on app, tooling and test configs
npm run build          # type-check + production bundle in dist/ (with sw.js and the manifest)
npm run preview        # serve dist/ (the service worker only exists in this build)
npm run e2e            # Playwright: builds, serves on port 4173, runs desktop + mobile
npm run icons          # regenerate public/*.png from public/icon.svg (only when the SVG changes)
```

Playwright needs its Chromium once: `npx playwright install chromium` (on Linux CI:
`npx playwright install --with-deps chromium`, which also installs system libraries).

Tests default to `TZ=America/Sao_Paulo`. To run them in another zone, set `TZ`
(Linux/macOS: `TZ=Pacific/Auckland npm test`; Windows PowerShell:
`$env:TZ='Pacific/Auckland'; npm test`; Git Bash drops `TZ`). CI runs the suite in
`America/Sao_Paulo`, `UTC` and `Pacific/Auckland`, and logs the gzip size of the bundle.

## Testing notes

Test pyramid (run `npm test` and `npm run e2e` for the current counts):

| Layer | Runner | Scope |
| --- | --- | --- |
| Unit (domain, state, storage, calendar, ui logic, i18n, pwa, themes and contrast) | Vitest, `node` project | pure logic, `tests/` |
| Component and integration (React, jsdom, fake-indexeddb) | Vitest, `dom` project | `src/**/*.test.tsx` |
| End-to-end (production build, real Chromium) | Playwright, `desktop` + `mobile` (Pixel 7) | `e2e/`; the shortcuts legend is checked per project, so one test is skipped in each |

End-to-end specs (`e2e/`): layout (no horizontal scroll at 320 and 360 px, light and
dark, in first run, deck, form, decks sheet and settings), gestures with real mouse
drags (right, left, up with Undo, a short drag that springs back), form (Enter flow,
time field, recurrence without a date), persistence (reload, active deck, language),
backup (export, import into a fresh context, invalid file), calendar (`.ics`
download: CRLF, SUMMARY, DTSTART, notice), offline (reload with the network off,
create and keep a task), accessibility (axe, failing on serious/critical, in light,
dark, pastel and neon; no rule disabled and no exception needed), i18n (`?lang=en`,
`<html lang>`), an overdue reminder using Playwright's controlled clock
(`page.clock`), themes (set before React, auto following the system, color-scheme),
the shortcuts legend per device, the collapsible tag filter, repeating cards and
snoozed cards coming back on their day (`page.clock`), days of the week with `BYDAY`,
the four-action bar at 320/360 px, and the tutorial with its isolated practice (the
IndexedDB contents compared before and after). Each test
gets a fresh browser context (empty IndexedDB) and starts from the first-run screen;
there are no fixed waits. "Clearing the site data" in the backup spec is a new
context, which has its own empty storage.

- Pure logic (domain, reducer, storage with fake-indexeddb, backup, gestures,
  formatting, dictionary parity, colour contrast) runs in the `node` project;
  components, hooks and end-to-end flows run in the `dom` project (jsdom).
- End-to-end persistence tests render `Root` on one fake IndexedDB and "reload" by
  unmounting and rendering again.
- **Dragging is not simulated in jsdom**; the decision is covered by `decideSwipe`
  and every action through buttons and keys. Real drags run in Playwright.
- Component tests fake only `Date` and build dates with local constructors, so they
  pass in every CI time zone.
- **Layout (horizontal overflow) cannot be tested in jsdom**, which computes no layout.
  An earlier version shipped a regression that made the app wider than a 360 px phone. Playwright
  now asserts `document.documentElement.scrollWidth <= clientWidth` at 320 and 360 px
  in the main states. To check by hand in DevTools at a phone width, this lists every
  element that sticks out on the right:
  `[...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > innerWidth + 1)`.

## Gesture and viewport debug panel (development only)

Open the dev server with `?debug=gestures` (e.g. `http://<LAN IP>:5173/?debug=gestures`)
to get a live panel: last pointer events and targets, top card id, flipped / exiting /
busy flags, drag offset and the `decideSwipe` result, exit animation status and age,
inner/visual viewport sizes (and innerHeight changes), inert elements, the top card's
opacity/transform/on-screen state, renders per second and a heartbeat delay. Reading
it: high heartbeat delay = main thread blocked; normal heartbeat but stuck UI = a
lock, `inert` or an overlay; "exit started" for more than 1 s = exit never finished;
innerHeight changing near the problem = viewport/keyboard; `pointercancel` during a
drag = the browser took the touch; pointerdown without "drag ON" = drag controls on
the wrong element; top card opacity 0 or OFF-SCREEN = the card is there but invisible.
The panel never intercepts touches and is not part of production builds.
