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
npm run build          # tsc -b && vite build
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
- Styling: CSS Modules + tokens from `src/index.css`; `vh` fallback before `dvh`. New
  text/background token pairs go into `tests/ui/contrast.test.ts` (WCAG AA, both themes).
- Ids: always `createId()` from `src/lib/id.ts`, never `crypto.randomUUID` (missing in
  insecure contexts such as `http://<LAN IP>` on a phone; ESLint enforces it).
- Motion is imported from `motion/react`. Find the top card through `data-top-card`.
- Do not simulate drag in jsdom. Component tests fake only `Date`
  (`vi.useFakeTimers({ toFake: ['Date'] })`); fake timers also freeze fake-indexeddb.

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

Stages 1 (domain core), 2 (card UI) and 3 (decks, tags, editing, IndexedDB
persistence with validation/quarantine/migrations, JSON backup, settings) are done.
The manual phone QA checklist (gestures and persistence) in the README is still open.

## Roadmap (remaining)

4. Due dates and recurrence in the UI (editing `originDay` already follows the due
   date in `updateTask`), `.ics` export.
5. Installable PWA, offline (service worker), Playwright end-to-end tests (including
   real drag gestures), deploy (Vercel, HTTPS).
6. Optional: Capacitor packaging for Android.
