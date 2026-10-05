# taskdeck

A mobile-first to-do app where tasks are cards in a deck: swipe right to complete,
left to send the card to the bottom, up to delete, tap to see the back. It runs
entirely in the browser (PWA, no backend).

**Current state: stage 1, the domain core.** Pure, fully tested TypeScript logic with
no UI, persistence, PWA or gestures yet. `src/App.tsx` only renders "taskdeck" so the
build has an entry point.

## Resumo em português

taskdeck é um app de tarefas em formato de cartas (arrastar para concluir, adiar ou
apagar), mobile-first e 100% no navegador, sem backend. Esta primeira etapa entrega só o
núcleo de domínio: regras puras de prazos, urgência, recorrência, adiamento e desfazer,
com testes rodando em três fusos horários. A interface vem nas próximas etapas.

## Stack

Vite + React + TypeScript (strict, `noUncheckedIndexedAccess`), client-only, no SSR.
Domain: [zod](https://zod.dev) 4 for schemas, [date-fns](https://date-fns.org) 4 for
calendar math. Tooling: Vitest with V8 coverage, ESLint (flat config) with
typescript-eslint in type-checked strict mode.

## Project structure

```
src/
  App.tsx, main.tsx     placeholder UI (build entry point only)
  domain/               pure domain core, no React/DOM/storage
    schemas.ts          zod schemas, types and createTask
    dates.ts            local-day and wall-clock helpers
    due-status.ts       getDueStatus: overdue / soon / today / ...
    urgency.ts          compareUrgency, orderDeck, topCard
    recurrence.ts       nextDue
    actions.ts          completeTask, postponeTask, removeTask, upsertTask
    history.ts          generic immutable undo/redo
    insights.ts         procrastinated
    compare.ts          internal comparators
    index.ts            public API (barrel)
tests/
  global-setup.ts       defaults TZ to America/Sao_Paulo
  domain/               one test file per domain module + fixtures
.github/workflows/ci.yml
```

## Scripts

Requires Node 24+ and npm.

```bash
npm install
npm run dev            # Vite dev server
npm test               # Vitest, once
npm run test:watch     # Vitest in watch mode
npm run test:coverage  # with V8 coverage (fails under 90% lines in src/domain)
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit on app, tooling and test configs
npm run build          # type-check + production bundle in dist/
```

Tests default to `TZ=America/Sao_Paulo`. To run them in another zone, set `TZ` in the
environment (Linux/macOS: `TZ=Pacific/Auckland npm test`; Windows PowerShell:
`$env:TZ='Pacific/Auckland'; npm test`). Git Bash on Windows drops `TZ` before it
reaches Node, so use PowerShell there. CI runs the suite in `America/Sao_Paulo`, `UTC`
and `Pacific/Auckland`.

## Domain design decisions

- **Injected clock and ids.** No domain function reads the current time or generates
  randomness: `now: Date` and ids are parameters. ESLint forbids `Date.now()`,
  `new Date()` without arguments, `Math.random()`, `crypto.randomUUID()`, React and
  DOM/storage globals inside `src/domain`. Everything is deterministic and testable.
- **Structured results, no UI text.** The domain returns data (`{ kind: 'overdue',
  overdueMinutes: 90 }`); the UI will translate it (PT/EN).
- **Immutability.** Functions never modify their arguments; parsed tasks are frozen
  by zod's `.readonly()`, and tests deep-freeze their inputs.
- **Due dates are wall-clock time.** `{ date: 'YYYY-MM-DD', time?: 'HH:mm' }` with no
  time zone: "Friday 18:00" means 18:00 wherever the device is. A date-only due is
  due at the end of that local day. Invalid days (2026-02-30) and times (25:00) are
  rejected by the schema.
- **Calendar-day arithmetic.** Day differences always use calendar days
  (`differenceInCalendarDays`), never milliseconds / 86 400 000, so DST days with 23
  or 25 hours do not shift results.
- **Urgency bands.** overdue → soon (timed due within 180 min) → today → tomorrow →
  week (2-7 days) → later → none. A due exactly at `now` is already overdue. Inside a
  band: priority, due instant, `createdAt`, then id, so the order is total and
  independent of input order.
- **Postpone lasts until the end of the day.** Swiping left sets `skippedAt`; the card
  sits below every non-postponed card (in postpone order) until the local day ends,
  then returns to its urgency position.
- **The postpone counter counts days, not swipes.** `postponedDays` grows only on the
  first postpone of a local day; `procrastinated()` uses it to surface tasks that keep
  being pushed away.
- **Recurrence anchors.** `anchor: 'due'` keeps a fixed schedule (next = due + interval,
  skipping missed occurrences so a late completion does not create a chain of overdue
  cards); `anchor: 'completion'` restarts from today (a weekly task completed today is
  due in 7 days). The next due date is always on a day after today, and the time of
  day is kept. Monthly `'due'` recurrences remember the original day of the month
  (`originDay`) so 31 Jan → 28 Feb (29 in leap years) → 31 Mar.
- **Undo is generic.** `History<T>` is an immutable past/present/future stack with a
  limit (50 by default); pushing after an undo discards the redo branch.

## Known limitations

- Wall-clock due dates follow the device: travelling to another zone changes the real
  instant a task is due. This is intended, but there is no "fixed instant" option.
- Local times that do not exist or happen twice on DST transition days are resolved by
  JavaScript `Date` (shifted forward / first occurrence). Not specifically tested.
- "Postponed today" and every day boundary use the device's current zone; changing zone
  in the middle of a day can move a card in or out of the postponed group.
- `originDay` is set by `createTask` only. Editing a monthly task's due date (stage 4)
  must recompute it; there is no `updateTask` yet.
- Monthly recurrences anchored on `'completion'` use plain month addition, so completing
  on 31 Jan schedules 28 Feb and then 28 Mar (they do not return to the 31st).
- `createTask` throws a `ZodError` on invalid input; callers must catch it (or validate
  first with `TaskSchema.safeParse`).
- There is no UI, persistence, PWA, or gesture handling yet.

## Roadmap

1. Domain core (done)
2. Card UI with gestures and undo
3. Decks, tags, local persistence
4. Due dates and recurrence editing, `.ics` export
5. PWA and backup
6. Optional: Capacitor/Android packaging
