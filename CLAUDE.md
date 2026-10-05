# CLAUDE.md

Guidance for working in this repository.

## Conventions

- Code, identifiers, tests, comments and commit messages are in **English**. The user
  communicates in Portuguese; the UI will be translated (PT/EN) later.
- Conventional commits (`feat(domain): ...`, `chore: ...`, `ci: ...`, `docs: ...`), one
  commit per logical part, each with its tests.
- TypeScript strict with `noUncheckedIndexedAccess`. No `any`. No non-null assertion
  (`!`) unless the line carries an `eslint-disable-next-line ... -- reason` comment.
- npm only. Node 24+.
- Never open, read or print `.env` files.

## Commands

```bash
npm run dev            # Vite dev server
npm test               # Vitest once (TZ defaults to America/Sao_Paulo)
npm run test:coverage  # V8 coverage, >= 90% lines required in src/domain
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

## Current state

Stage 1 is done: domain core (schemas, dates, due status, urgency/deck order,
recurrence, actions, undo history, insights) with tests passing in
America/Sao_Paulo, UTC and Pacific/Auckland. There is **no UI** beyond a placeholder
`App.tsx`, and no persistence, PWA or gestures.

## Roadmap

1. ~~Domain core~~ (done)
2. Card UI with gestures (right = complete, left = postpone, up = delete, tap = flip)
   and undo, using `History<T>`.
3. Decks (`Deck` type already exists), tags, local persistence (validate stored data
   with the zod schemas on load).
4. Due-date and recurrence editing (recompute `originDay` when the due date changes),
   `.ics` export.
5. PWA (offline, installable) and backup/restore.
6. Optional: Capacitor packaging for Android.
