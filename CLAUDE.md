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
- Do not change `src/domain` unless fixing a real bug: first a failing test that
  reproduces it, then the fix in its own commit.

## Commands

```bash
npm run dev            # Vite dev server (-- --host to reach it from a phone)
npm test               # Vitest once: "node" and "dom" (jsdom) projects
npm run test:coverage  # V8 coverage, >= 90% lines required in src/domain and src/state
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

## UI conventions (stage 2)

- `src/state/deckReducer.ts` is pure (no React); every action carries `now`.
- Swipe meaning comes only from `decideSwipe` (`src/ui/gestures.ts`). Gestures,
  buttons and keys all go through `App.requestAction` → exit animation → dispatch.
- Styling: CSS Modules + tokens from `src/index.css`. New text/background token pairs
  must be added to `tests/ui/contrast.test.ts` (WCAG AA in light and dark).
- Ids: always `createId()` from `src/lib/id.ts`, never `crypto.randomUUID` (missing in
  insecure contexts such as `http://<LAN IP>` on a phone; ESLint enforces it).
- Motion is imported from `motion/react`. Do not hand callback refs to cards that can
  be promoted in the stack; find the top card through `data-top-card` instead.
- Do not simulate drag in jsdom; test the decision with `decideSwipe` and the actions
  through buttons/keys. Component tests fake only `Date` (`vi.useFakeTimers({ toFake: ['Date'] })`).

## Current state

Stage 1 (domain core) and stage 2 (card UI) are done. One deck screen with drag,
buttons and keyboard for every action, undo/redo with toast, live-region
announcements, a minimal "new task" sheet and pt-BR/en. State is in memory, seeded
with demo data (`src/demo/seed.ts`). The manual phone QA checklist in the README is
still open.

## Roadmap (remaining)

3. Multiple decks (`Deck` type already exists), tags, local persistence (validate
   stored data with the zod schemas on load).
4. Due-date and recurrence editing (recompute `originDay` when the due date changes),
   `.ics` export.
5. PWA (offline, installable), backup/restore and Playwright end-to-end tests
   (including real drag gestures).
6. Optional: Capacitor packaging for Android.
