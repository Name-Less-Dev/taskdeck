# CLAUDE.md

Guidance for working in this repository.

## Conventions

- Code, identifiers, tests, comments and commit messages are in **English**. The user
  communicates in Portuguese. UI text lives only in `src/i18n` (pt-BR default, en);
  never hard-code user-visible strings in components.
- Conventional commits (`feat(domain): ...`, `feat(ui): ...`, `test(ui): ...`, `ci: ...`,
  `docs: ...`), one commit per logical part, each with its tests.
- TypeScript strict with `noUncheckedIndexedAccess`. No `any`. No non-null assertion
  (`!`) unless the line carries an `eslint-disable-next-line ... -- reason` comment.
- npm only. Node 24+.
- Never open, read or print `.env` files.
- `src/domain` may grow with new PURE functions; existing behaviour only changes to fix
  a real bug: first a failing test that reproduces it, then the fix in its own commit.

## Commands

```bash
npm run dev            # Vite dev server (-- --host to reach it from a phone)
npm test               # Vitest once: "node" and "dom" (jsdom) projects
npm run test:coverage  # V8 coverage, >= 90% lines required in src/domain, src/state, src/storage
npm run lint           # ESLint (type-checked)
npm run typecheck      # tsc --noEmit for app, tooling and tests
npm run build          # tsc -b && vite build (also emits sw.js + manifest)
npm run e2e            # Playwright (builds, serves on :4173, desktop + Pixel 7)
npm run icons          # regenerate public/*.png from public/icon.svg
```

On Windows, run time-zone checks from PowerShell (`$env:TZ='UTC'; npm test`); Git Bash
strips `TZ` before it reaches Node.

## Domain architecture rule (enforced by ESLint for `src/domain/**`)

- No imports of `react` / `react-dom`; no DOM, storage or environment globals
  (`window`, `document`, `localStorage`, `indexedDB`, `fetch`, `crypto`, `process`, ...).
- No `Date.now()`, `new Date()` without arguments, `Date()`, `Math.random()`,
  `crypto.randomUUID()`. Time (`now: Date`) and ids are always parameters.
- Return structured data, never UI strings.
- Immutable: never modify arguments; return new objects/arrays.
- The public API is whatever `src/domain/index.ts` exports. `compare.ts` is internal.
- Day differences use calendar days (`differenceInCalendarDays`), never ms / 86 400 000.
- Tests build dates with local constructors (`new Date(2026, 9, 5, 10, 0)`), never UTC
  strings, so they pass in any zone. Fixed `now`: 5 Oct 2026 10:00 local.
- No snapshot tests; no empty tests to inflate coverage.

## UI conventions

- `src/state/deckReducer.ts` is pure (no React); the state is `History<AppData>`, every
  action carries `now` and its ids, and invalid/no-op actions return the same state.
- Swipe meaning comes only from `decideSwipe` (`src/ui/gestures.ts`). Gestures,
  buttons and keys all go through `App.requestAction` → exit animation → dispatch.
- Every sheet is built on `components/Sheet.tsx` (focus trap, Escape, aria-modal);
  App makes the page `inert` and returns focus to the opener or the deck.
- Never put a control inside the card (`role="button"`); siblings only (see Edit).
- Layout must fit 320 px with no horizontal page scroll. Grid columns that hold
  content use `minmax(0, 1fr)`; flex/grid children that hold text get `min-width: 0`;
  long single-line text uses ellipsis; size things from their container (`100%`), not
  `vw`. `overflow-x: clip` on html/body is only a safety net: never rely on it. jsdom
  cannot catch overflow, so check a real browser at 320/360 px
  (`document.documentElement.scrollWidth <= clientWidth`, and no element whose right
  edge passes `innerWidth`); `e2e/layout.spec.ts` checks it in the main states.
- Styling: CSS Modules + tokens from `src/index.css`; `vh` fallback before `dvh`. New
  text/background token pairs go into `tests/ui/contrast.test.ts` (WCAG AA, both themes).
- Ids: always `createId()` from `src/lib/id.ts`, never `crypto.randomUUID` (missing in
  insecure contexts such as `http://<LAN IP>` on a phone; ESLint enforces it).
- Motion is imported from `motion/react`. Find the top card through `data-top-card`.
- Card exits go through the pure state machine in `src/ui/exitState.ts` (request →
  finished | interrupted | 600 ms timeout → commit). Any motion value a card animates
  must be reset when its exit ends: the same card instance (keyed by task id) comes
  back for postponed and recurring tasks.
- The shell is a flex column where only `<main>` grows: adding a bar (banner, filter)
  must not change the deck's height logic. Cards are capped to the deck area.
- Forms: Enter moves to the next field in single-line inputs and submits only on the
  field marked `data-submit-on-enter` (`src/ui/form-navigation.ts`); set
  `enterkeyhint` (next/done/enter) to match, it only changes the key label.
- Debug gestures/viewport on a device with `?debug=gestures` (dev only, see README).
- Do not simulate drag in jsdom. Component tests fake only `Date`
  (`vi.useFakeTimers({ toFake: ['Date'] })`); fake timers also freeze fake-indexeddb.

## Calendar and reminders conventions (stage 4)

- `src/calendar` is pure (same ESLint rules as the domain): text comes in as labels,
  time as `now`. Any change to the `.ics` output must keep `tests/calendar/ics.parser.test.ts`
  (ical.js) passing; do not emit rules ical.js expands differently from `nextDue`.
- Floating local times in `.ics` (no Z, no TZID), like due dates in the app.
- Reminder rules live in `src/ui/reminders.ts` (pure, on top of `diffDueBands`); the
  hook only feeds it tasks, `now` and page visibility.
- New settings go into `meta.settings` with a zod default, so older meta still loads
  (as `alarm` did); a breaking change still needs `SCHEMA_VERSION` + a migration.

## PWA and end-to-end conventions (stage 5)

- The service worker exists only in the production build (vite-plugin-pwa,
  `registerType: 'prompt'`). Never reload on the user's behalf; the update toast is
  hidden while a sheet is open (`shouldOfferUpdate`).
- PWA state reaches the app through `PwaContext` (`src/pwa/context.ts`); only
  `PwaProvider.tsx` imports `virtual:pwa-register/react`, so tests use `NO_PWA` or
  their own context value.
- Install and update decisions are pure (`src/pwa/install.ts`, `src/pwa/update.ts`).
- New icons: edit `public/icon.svg`, run `npm run icons`, commit the PNGs.
- Playwright: one fresh context per test, start from the first-run screen, web-first
  assertions only (no `waitForTimeout`). Specs live in `e2e/` and are not part of
  Vitest.
- IndexedDB saves call `tx.commit()` after queuing every write: a save started on
  `pagehide` must survive an immediate reload.

## Storage conventions (stage 3)

- Everything goes through `AppStorage` (`src/storage`); never touch IndexedDB elsewhere.
- Loading validates every record with the domain schemas; invalid records go to
  quarantine, never silently dropped. Repairs ("Geral", "Recuperadas") get localized
  names from the caller.
- Changing the persisted format: bump `SCHEMA_VERSION`, add a step to `MIGRATIONS` and
  a test. Data from a newer version must never be overwritten (read-only mode).
- A save is one transaction; do not await anything else while it is open.
- Sample tasks enter only through the first-run button, never over saved data.

## Current state

Stages 1 to 5 are done: domain core, card UI, decks/tags/editing/IndexedDB/backup,
recurrence/reminders/`.ics`, and stage 5 (installable PWA with offline precache and
an update prompt, install button / iOS hint, HH:mm time field, post-export notice,
Playwright e2e on CI, metadata). Deployed at https://taskdeck-flax.vercel.app.

**DEFINITION OF DONE REACHED. Features are frozen**: only bug fixes (test first, fix in
its own commit), dependency updates and documentation from now on.

Still manual (see the README): the phone QA checklists (gestures, persistence,
calendar and reminders, PWA and time field), `public/og.png` (1200x630),
`docs/screenshot-deck.png` and `docs/demo.gif`. Verified by hand so far: only an
`.ics` imported into an Android calendar (time, daily repetition, alarm fired).

## Roadmap

6. Optional and future: Capacitor packaging for Android with local (system)
   notifications. Not started.
