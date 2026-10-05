# taskdeck

A mobile-first to-do app where tasks are cards in a deck: swipe right to complete,
left to send the card to the bottom, up to delete, tap to see the back. It runs
entirely in the browser (PWA, no backend).

**Current state: stage 2, the card UI.** A single deck screen with gestures, buttons
and keyboard shortcuts for every action, undo/redo, a minimal "new task" sheet and
pt-BR/en texts, on top of the pure domain core from stage 1. State lives in memory
and starts from demo data: there is no persistence, no multiple decks and no PWA yet.

## Resumo em português

taskdeck é um app de tarefas em formato de cartas (arrastar para concluir, adiar ou
apagar; tocar para ver o verso), mobile-first e 100% no navegador, sem backend. A
etapa 2 entrega a tela do baralho com gestos, botões e atalhos de teclado
equivalentes, desfazer/refazer, criação de tarefas e textos em pt-BR/en. Os dados são
de demonstração e ficam só na memória por enquanto.

## Features

- **Card deck** ordered by urgency (overdue → soon → today → tomorrow → this week →
  later → no due date). The top card is draggable; up to two more cards are drawn
  underneath.
- **Gestures**: right = complete, left = postpone to the end of the day, up = delete,
  tap = flip to the back (description, full due date, priority, recurrence,
  postponed days). Coloured overlays with icon and text grow as you drag.
- **Same actions without gestures**: Postpone / Delete / Complete buttons in the thumb
  zone, Undo / Redo in the header, and keyboard shortcuts. All of them go through the
  same exit animation and the same reducer action.
- **Undo** for every action (50 steps) from the header, `Ctrl/⌘+Z`, or the
  "Task completed · Undo" toast (6 s, paused while hovered or focused).
- **New task** sheet: title, description, priority, optional due date and time,
  validated by the domain's `createTask` with per-field accessible errors.
- **Live due badges** ("Overdue by 2 h", "In 45 min", "Today", "In 3 days"...) that
  update on their own every 30 s and when the tab becomes visible.
- **Accessibility**: polite live region announcing every action and the empty deck,
  focus returned to the deck after actions and after closing the sheet, visible focus,
  AA contrast checked by a test, meaning never carried by colour alone, reduced-motion
  support.
- **i18n**: pt-BR (default) and en; `?lang=en` or `?lang=pt-BR` forces a language.

### Keyboard shortcuts (focus on the deck)

| Key | Action |
| --- | --- |
| `Enter` / `Space` | Flip the card |
| `→` | Complete |
| `←` | Postpone |
| `Delete` / `Backspace` | Delete |
| `Ctrl/⌘ + Z` | Undo |
| `Ctrl + Shift + Z` / `Ctrl + Y` | Redo |

## Stack

Vite + React 19 + TypeScript (strict, `noUncheckedIndexedAccess`), client-only, no SSR.
Domain: [zod](https://zod.dev) 4, [date-fns](https://date-fns.org) 4. UI:
[Motion](https://motion.dev) (`motion` package, imported from `motion/react`; formerly
Framer Motion) for dragging and animation, CSS Modules with CSS custom properties
(light and dark themes via `prefers-color-scheme`), a small typed i18n dictionary (no
library). Tooling: Vitest (node + jsdom projects) with V8 coverage, Testing Library,
ESLint (flat config) with typescript-eslint in type-checked strict mode.

## Project structure

```
src/
  main.tsx, App.tsx     entry point; App owns the deck state, focus and announcements
  index.css             design tokens (colour, radius, spacing, shadow) + light/dark
  domain/               pure domain core (stage 1), no React/DOM/storage
  state/deckReducer.ts  pure reducer: History<Task[]> + add/complete/postpone/remove/undo/redo
  ui/
    gestures.ts         decideSwipe: pure swipe decision + thresholds
    format.ts           DueStatus/dates/recurrence -> text (via the dictionary)
    form-errors.ts      ZodError -> per-field messages
    useNow.ts           ticking clock hook
  i18n/                 typed pt-BR and en dictionaries, locale detection, provider
  components/           Deck, TaskCard, ActionBar, UndoToast, AddTaskSheet,
                        EmptyState, LiveRegion, Icon (+ .module.css and tests)
  demo/seed.ts          createDemoTasks(now): in-memory demo deck
  test/                 Testing Library setup and render helper
tests/                  node-environment tests (domain, state, gestures, i18n, contrast)
.github/workflows/ci.yml
```

## Scripts

Requires Node 24+ and npm.

```bash
npm install
npm run dev            # Vite dev server (add -- --host to open it from a phone)
npm test               # Vitest, once (node + jsdom projects)
npm run test:watch     # Vitest in watch mode
npm run test:coverage  # with V8 coverage (fails under 90% lines in src/domain or src/state)
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit on app, tooling and test configs
npm run build          # type-check + production bundle in dist/
```

Tests default to `TZ=America/Sao_Paulo`. To run them in another zone, set `TZ` in the
environment (Linux/macOS: `TZ=Pacific/Auckland npm test`; Windows PowerShell:
`$env:TZ='Pacific/Auckland'; npm test`). Git Bash on Windows drops `TZ` before it
reaches Node, so use PowerShell there. CI runs the suite in `America/Sao_Paulo`, `UTC`
and `Pacific/Auckland`, and logs the gzip size of the bundle.

## UI design decisions

- **The swipe decision is pure.** Motion only reports what happened (offset, velocity,
  card size); `decideSwipe` decides what it means: the dominant axis must be clear
  (|x|/|y| between 0.7 and 1.4 is ignored), then 30% of the width horizontally or 22%
  of the height upwards, or a flick of at least 500 px/s with 40 px of travel in the
  same direction. Down does nothing. The rule is a table-driven unit test.
- **Tap vs drag.** A drag only starts after 8 px of movement (Motion drag controls
  with `distanceThreshold`), so a short press is a tap that flips the card.
- **State is an undo history.** The reducer's state is the domain's
  `History<Task[]>` (50 steps). Every action carries its `now`; the reducer never reads
  the clock. Actions that change nothing (unknown id, task already done) return the
  same state, so they push nothing onto the history.
- **The gesture is never the only way.** Buttons, keys and swipes call the same
  `requestAction`: the card plays its exit animation first and the reducer action is
  dispatched only when it ends.
- **Dynamic badges.** The deck is `orderDeck(present, now)` computed while rendering,
  with `now` from `useNow` (30 s tick + `visibilitychange`), so badges and order move
  on their own (e.g. "Today" turns into "Overdue" at midnight).
- **The domain stays text-free.** It returns structured data; `format.ts` and the
  dictionaries turn it into words with correct plurals (`Intl.PluralRules`).
- **Reduced motion.** With `prefers-reduced-motion`, no tilt, no spring and no 3D flip:
  cards fade instead. Dragging still works.

## Domain design decisions

- **Injected clock and ids.** No domain function reads the current time or generates
  randomness: `now: Date` and ids are parameters. ESLint forbids `Date.now()`,
  `new Date()` without arguments, `Math.random()`, `crypto.randomUUID()`, React and
  DOM/storage globals inside `src/domain`. Everything is deterministic and testable.
- **Structured results, no UI text.** The domain returns data (`{ kind: 'overdue',
  overdueMinutes: 90 }`); the UI translates it (PT/EN).
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

## Testing notes

- Pure logic (domain, reducer, gestures, formatting, form errors, dictionary parity,
  colour contrast) runs in the `node` Vitest project; components and hooks run in the
  `dom` project (jsdom + Testing Library + user-event). Animations are skipped in jsdom
  (`MotionGlobalConfig.skipAnimations`).
- **Dragging is not simulated in jsdom** (pointer-driven drag there is unreliable).
  The decision is covered by `decideSwipe`'s tests and every action is exercised
  through buttons and keys, which share the exact code path after the decision. The
  real drag must be checked on a device (below) and, later, with Playwright (stage 5).
- Component tests fake only `Date` (fixed at 5 Oct 2026 10:00 local) and build dates
  with local constructors, so they pass in every CI time zone.

## Manual QA on a phone

Not done yet: this needs a real device. Run `npm run dev -- --host`, then open the
"Network" URL Vite prints (e.g. `http://192.168.0.10:5173`) on a phone on the same
Wi-Fi. On Windows, allow Node.js through the firewall for private networks when asked
(or the phone will time out).

- [ ] Swipe right, left and up: overlay grows with the distance, card leaves, action applies
- [ ] Release before the threshold: card springs back, nothing happens
- [ ] Short fast flick in each direction triggers the action
- [ ] Tap flips the card; a tiny accidental move still counts as a tap
- [ ] Undo from the toast, the header button and (with a keyboard) `Ctrl+Z`
- [ ] The page does not scroll or bounce while dragging; no pull-to-refresh
- [ ] Dragging from the middle of the card does not trigger the system "back" gesture
- [ ] The on-screen keyboard does not cover the fields of the "New task" sheet
- [ ] Dark mode (system setting) looks right and stays readable
- [ ] Rotating the screen keeps the layout usable
- [ ] Screen reader (TalkBack / VoiceOver): card name, flip state, actions and
      announcements are read

## Known limitations

- No persistence: reloading the page resets the demo deck (stage 3).
- Gestures and the layout have only been tested in jsdom so far (see "Manual QA").
- The bundle is about 150 kB gzip (React + Motion + zod). Motion's `LazyMotion` and a
  lighter validation path could cut it later.
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

## Roadmap

1. Domain core (done)
2. Card UI with gestures, buttons/keyboard and undo (done)
3. Decks, tags, local persistence
4. Due dates and recurrence editing, `.ics` export
5. PWA, backup and Playwright end-to-end tests
6. Optional: Capacitor/Android packaging
