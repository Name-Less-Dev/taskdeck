# taskdeck

A mobile-first to-do app where tasks are cards in a deck: swipe right to complete,
left to send the card to the bottom, up to delete, tap to see the back. It runs
entirely in the browser (PWA, no backend).

**Current state: stage 4, deadlines, recurrence, reminders and calendar export.**
Recurrence can be set, edited and removed in the task form; cards show their
repetition and escalate as deadlines approach; in-app reminders announce tasks that
become due while the app is open; tasks with a due date export to `.ics` (one or
all). Built on stage 3 (decks, tags, editing, IndexedDB, JSON backup), stage 2 (card
UI) and stage 1 (pure domain). No PWA or service worker (stage 5), no system
notifications (stage 6), no backend.

## Resumo em português

taskdeck é um app de tarefas em formato de cartas (arrastar para concluir, adiar ou
apagar; tocar para ver o verso), mobile-first e 100% no navegador, sem backend. A
etapa 4 traz recorrência editável no formulário, cartas que mudam de cor (sempre com
ícone e texto) conforme o prazo se aproxima, avisos com o app aberto quando uma tarefa
fica perto do prazo ou vence, e exportação para o calendário (.ics) com alarme. PWA e
notificações do sistema vêm nas próximas etapas.

## Features

- **Card deck** ordered by urgency (overdue → soon → today → tomorrow → this week →
  later → no due date). The top card is draggable; up to two more cards are drawn
  underneath.
- **Gestures**: right = complete, left = postpone to the end of the day, up = delete,
  tap = flip to the back. Coloured overlays with icon and text grow as you drag.
- **Same actions without gestures**: Postpone / Delete / Complete buttons in the thumb
  zone, Undo / Redo in the header, and keyboard shortcuts.
- **Undo** for every change (50 steps): task actions, edits, deck changes and
  imports, from the header, `Ctrl/⌘+Z`, or the toast (6 s, paused on hover/focus).
- **Decks**: the header button shows the active deck and opens the Decks sheet (all
  decks with active-task counts, "All decks", create, rename, delete with a
  confirmation that states how many tasks go with it; the last deck cannot be
  deleted). In "All decks", cards show their deck (when there is more than one).
- **Tags**: chips in the task form (Enter or comma adds, Backspace removes the last),
  up to 3 + "+N" on the card front and all on the back, and a filter bar with counts.
- **Editing**: "Edit" on the back of the card (or `E`) opens the same form,
  prefilled; recurring tasks keep their recurrence.
- **Persistence**: everything is saved in IndexedDB automatically; the app opens
  where you left it (active deck and language included).
- **Backup**: export a dated `.json` file and import it back (summary, confirmation,
  undo) from Settings.
- **Settings**: language (Automatic / Português / English), persistent-storage status,
  last backup date, export/import, quarantined records.
- **Accessibility**: live region announcements, focus returned to the opener (or the
  deck) when sheets close, focus trapped in sheets, visible focus, AA contrast checked
  by a test, never colour alone, reduced-motion support.
- **Recurrence in the form**: a "Repeat" block (every N days/weeks/months, counted from
  the due date or from completion) to set, change or remove a task's repetition; a
  repeating task needs a due date. Cards show a short badge ("Toda semana") and the full
  rule on the back; completing one says "Rescheduled for <date>" (undoable).
- **Deadline escalation**: border and background follow the band (soon amber, overdue
  red), always with an icon and text; "soon" pulses gently unless reduced motion is on.
- **In-app reminders**: when time moves a task into "soon" or "overdue" while the app is
  open, a discreet notice appears and is announced (grouped when several change; one
  summary after returning to a hidden tab; never repeated; Esc or button to dismiss).
- **Calendar export (.ics)**: "Calendar" on the back of a card exports that task;
  Settings exports every active task with a due date (or just the active deck), with
  an alarm setting (none, at the time, 15 min, 1 h, 1 day before; default 15 min).
- **i18n**: pt-BR (default) and en; `?lang=en|pt-BR` in the address wins over the
  saved choice.

### Keyboard shortcuts (focus on the deck)

| Key | Action |
| --- | --- |
| `Enter` / `Space` | Flip the card |
| `E` | Edit the card |
| `→` | Complete |
| `←` | Postpone |
| `Delete` / `Backspace` | Delete |
| `Ctrl/⌘ + Z` | Undo |
| `Ctrl + Shift + Z` / `Ctrl + Y` | Redo |

## Stack

Vite + React 19 + TypeScript (strict, `noUncheckedIndexedAccess`), client-only, no SSR.
Domain: [zod](https://zod.dev) 4, [date-fns](https://date-fns.org) 4. UI:
[Motion](https://motion.dev) (`motion` package, imported from `motion/react`), CSS
Modules with CSS custom properties (light/dark), a small typed i18n dictionary.
Storage: [idb](https://github.com/jakearchibald/idb) 8. Tooling: Vitest (node + jsdom
projects) with V8 coverage, Testing Library,
[fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB) 6, ESLint (flat config)
with typescript-eslint in type-checked strict mode.

**Why idb and fake-indexeddb.** `idb` (by Jake Archibald) is a ~1 kB promise wrapper
that keeps IndexedDB's own semantics (real transactions, `tx.done` rejecting on
failure) and types the stores with a `DBSchema`; it hides nothing we need and adds no
abstraction of its own. `fake-indexeddb` is a pure-JavaScript, in-memory
implementation of the IndexedDB API that runs in Node and jsdom, follows the spec
closely (it is checked against the Web Platform Tests), and gives each test an
isolated database through `new IDBFactory()`. Both were checked against their current
documentation and the installed type definitions (idb 8.0.3, fake-indexeddb 6.2.5).

## Project structure

```
src/
  main.tsx              entry: error overlay (dev), ErrorBoundary, Root
  Root.tsx              opens storage, loads, then renders App / loading / read-only
  App.tsx               deck state, sheets, focus, announcements, autosave
  index.css             design tokens + light/dark
  domain/               pure domain core: schemas, dates, urgency, recurrence,
                        actions, decks (AppData), tags, updateTask, history
  state/deckReducer.ts  pure reducer over History<AppData>
  storage/              AppStorage interface, IndexedDB + memory implementations,
                        snapshot validation, migrations, autosaver, persistence,
                        JSON backup
  ui/                   gestures, formatting, form errors, tags, hooks
                        (useNow, useAutosave, usePersistence), download
  i18n/                 typed pt-BR and en dictionaries, locale resolution
  components/           Deck, TaskCard, ActionBar, UndoToast, Sheet, TaskFormSheet,
                        TagInput, TagFilterBar, DeckSheet, SettingsSheet,
                        StartupScreens, StorageBanner, EmptyState, LiveRegion, ...
  lib/id.ts             createId(): UUID v4 in any context
  dev/                  dev-only on-page error overlay
  demo/seed.ts          sample tasks (first run only, by explicit choice)
tests/                  node-environment tests (domain, state, storage, ui, i18n)
.github/workflows/ci.yml
```

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
npm run build          # type-check + production bundle in dist/
```

Tests default to `TZ=America/Sao_Paulo`. To run them in another zone, set `TZ`
(Linux/macOS: `TZ=Pacific/Auckland npm test`; Windows PowerShell:
`$env:TZ='Pacific/Auckland'; npm test`; Git Bash drops `TZ`). CI runs the suite in
`America/Sao_Paulo`, `UTC` and `Pacific/Auckland`, and logs the gzip size of the bundle.

## Data model

```ts
AppData = { decks: Deck[]; tasks: Task[] }   // invariants: >= 1 deck; every task.deckId exists
Deck    = { id; name }                       // 1-30 chars, trimmed, unique ignoring case
Task    = { id, deckId, title, description, tags, priority, due, recurrence,
            status, createdAt, completedAt, skippedAt, postponedDays }
Meta    = { schemaVersion: 1,
            settings: { activeDeckId: string | null, language: 'auto' | 'pt-BR' | 'en' },
            lastBackupAt: ISO | null }
```

`checkIntegrity(data)` lists every broken invariant (no deck, duplicate ids, orphan
tasks). The undoable app state is `History<AppData>`; the active deck and the tag
filter are UI state outside the history (the active deck is saved in `Meta`, the tag
filter is per session).

## Persistence design

- **Interface.** `AppStorage { load(), save(data, meta), clear() }`, asynchronous, with
  two implementations: IndexedDB (stores `decks`, `tasks`, `meta`, `quarantine`) and
  memory (same interface, used as the fallback and in tests). The name avoids
  shadowing the DOM's `Storage` type.
- **One transaction per save.** `save` clears and rewrites decks and tasks and writes
  meta in a single readwrite transaction: all of it or none of it. A request that
  fails synchronously (e.g. a value that cannot be cloned) aborts the transaction, so
  earlier writes in it never commit.
- **Validation on load, with quarantine.** Every record is validated with the domain
  schemas. Invalid ones are not dropped silently: they move to the `quarantine` store
  with the error, and the count is shown in Settings. If no deck is left, "Geral" is
  created; tasks whose deck is missing go to "Recuperadas" (same rule as imports).
- **Migrations.** `migrate(raw)` is pure and applies one registered step per version.
  The format is at v1, so the registry is empty, but the mechanism is tested with a
  fictional v0. A snapshot from a **newer** version is never loaded and never
  overwritten: the app opens read-only with a warning and can export the raw records.
- **Debounce and flush.** Changes are saved ~300 ms after the last one; saving
  happens immediately when the page is hidden (`visibilitychange`) or unloaded
  (`pagehide`). Saves never overlap. A failed save shows a discreet "Try again".
- **Persistent storage.** After the first user action, `navigator.storage.persist()`
  is requested if it exists (it only exists in secure contexts); Settings shows yes /
  no / unavailable.
- **Fallback.** If IndexedDB cannot be opened (private mode, blocked, quota, missing,
  or a hung open), the app runs on memory with a persistent warning; export still
  works.
- **First run.** An empty database offers "Load sample tasks" or "Start from scratch".
  Sample tasks only ever come from that button, never on top of saved data.

## Backup policy

Backups are plain JSON (`{ app: "taskdeck", schemaVersion, exportedAt, decks, tasks }`,
2-space indented) named `taskdeck-backup-YYYY-MM-DD.json` (local date). Exporting
records the date, shown in Settings as "Last backup". Importing validates the file
and reports distinct errors (not JSON, not a taskdeck backup, newer version, invalid
field with its path, duplicate ids); tasks whose deck is missing go to "Recuperadas"
with a warning. The import shows a summary, asks for confirmation, replaces all data,
and can be undone during the session. Because browsers may evict local data,
exporting a backup now and then is the recommended safety net.

## UI design decisions

- **The swipe decision is pure.** `decideSwipe` turns offset/velocity/size into an
  action (30% of the width, 22% of the height upwards, or a 500 px/s flick with 40 px
  of travel; ambiguous diagonals and downward swipes do nothing).
- **Tap vs drag.** A drag starts only after 8 px of movement.
- **The gesture is never the only way.** Buttons, keys and swipes share
  `requestAction`: exit animation first, reducer action after.
- **Shared sheet.** Every sheet uses one dialog component (focus trap, Escape,
  `aria-modal`, `inert` page behind it); focus returns to the button that opened it.
- **No nested controls.** The card is a `role="button"`; the Edit button sits next to
  it in the DOM (over the back of the card), never inside it.
- **The toast lives outside the page shell**, so "Undo" stays usable above a sheet.
- **Dynamic badges** recompute from `useNow` (30 s tick + `visibilitychange`).
- **The domain stays text-free**; names it must create ("Geral", "Recuperadas") come
  from the dictionary of the current language.

## Domain design decisions

- **Injected clock and ids**, enforced by ESLint inside `src/domain`.
- **Structured results, no UI text.**
- **Immutability.** Functions never modify their arguments; tests deep-freeze inputs.
- **Due dates are wall-clock time** (`{ date, time? }`, no zone); a date-only due is
  due at the end of that local day.
- **Calendar-day arithmetic** (`differenceInCalendarDays`).
- **Urgency bands** with a total order: band, priority, due, `createdAt`, id.
- **Postpone lasts until the end of the day**; `postponedDays` counts days, not swipes.
- **Recurrence anchors** `'due'` (fixed schedule, skips missed occurrences) and
  `'completion'` (restarts from today); monthly `'due'` keeps `originDay`.
- **Decks and edits.** `createDeck`/`renameDeck` reject duplicate names ignoring case;
  `removeDeck` removes the deck and its tasks and refuses the last one; `updateTask`
  edits only title, description, tags, priority, due and deck, keeping recurrence and
  counters (and refuses to drop the due date of a recurring task).

## Testing notes

- Pure logic (domain, reducer, storage with fake-indexeddb, backup, gestures,
  formatting, dictionary parity, colour contrast) runs in the `node` project;
  components, hooks and end-to-end flows run in the `dom` project (jsdom).
- End-to-end persistence tests render `Root` on one fake IndexedDB and "reload" by
  unmounting and rendering again.
- **Dragging is not simulated in jsdom**; the decision is covered by `decideSwipe`
  and every action through buttons and keys. Real drag: on a device, then Playwright
  (stage 5).
- Component tests fake only `Date` and build dates with local constructors, so they
  pass in every CI time zone.
- **Layout (horizontal overflow) cannot be tested in jsdom**, which computes no layout.
  Stage 3 shipped a regression that made the app wider than a 360 px phone (the shell's
  grid column grew to the header's min-content). Until stage 5 it is checked by hand;
  in stage 5 a Playwright test will assert
  `document.documentElement.scrollWidth <= document.documentElement.clientWidth` with
  viewports of 320 and 360 px, in every main state (deck, flipped card, each sheet,
  toast, settings). To check by hand in DevTools at a phone width, this lists every
  element that sticks out on the right:
  `[...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > innerWidth + 1)`.

## Fixed bugs worth remembering

- **Enter in the task form created the task** (stage 3). The virtual keyboard's
  action key sends Enter, and Enter in a single-line field implicitly submits a
  `<form>`; `enterkeyhint` only changes the key's label. The form now handles Enter:
  next field in single-line fields, submit on the last one (time), new line in the
  description, Ctrl/Cmd+Enter submits anywhere, nothing while an IME is composing.
- **Invisible card / "frozen" deck after creating cards in the form** (stage 3), two
  independent causes, both reproduced before fixing:
  1. *Layout.* The shell was a 3-row grid (`auto 1fr auto`); stage 3 added more rows
     (tag bar, banners), so as soon as a task had tags (only possible through the
     form) the flexible row went to the tag bar, `<main>` collapsed to its padding,
     the deck area had 0 height and the card spilled over the action bar; `focus()`
     then scrolled the `overflow: hidden` shell and pushed the header off-screen.
     Measured at 360x740: rows 72/509/32/127 px, shell scrollTop 285. Fix: a flex
     column where only `<main>` grows, `overflow: clip`, card capped to the deck area.
  2. *Motion values.* The exit animation leaves the card off-screen with opacity 0.
     A postponed (or completed recurring) task keeps the same card instance, so it
     came back to the top invisible and ~1200 px away: drags hit nothing, only the
     buttons worked. Fix: reset x/y/opacity when the exit ends. Also, an exit
     interrupted because the card lost the top never ended and blocked every action;
     the exit is now a pure state machine (`src/ui/exitState.ts`) that always commits
     (finished, interrupted, or after a 600 ms safety-net timeout).

### Gesture and viewport debug panel (development only)

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

## Manual QA on a phone

Not done yet: this needs a real device. Run `npm run dev -- --host`, then open the
"Network" URL Vite prints (e.g. `http://192.168.0.10:5173`) on a phone on the same
Wi-Fi. On Windows, allow Node.js through the firewall for private networks when asked.

**`http://<LAN IP>` is not a secure context.** Browsers only treat HTTPS and
`localhost` as secure, so on the phone over plain HTTP: `crypto.randomUUID` does not
exist (ids come from `createId()`, which falls back to `getRandomValues`), there is no
service worker and no PWA install, and `navigator.storage` (persistent storage) is
missing, so Settings shows "unavailable". IndexedDB itself works. **PWA and
persistent-storage testing (stage 5) require HTTPS**: use the Vercel URL. In
development, uncaught errors are printed on the page by a small overlay.

Gestures and layout:

- [ ] Swipe right, left and up: overlay grows with the distance, card leaves, action applies
- [ ] Release before the threshold: card springs back, nothing happens
- [ ] Short fast flick in each direction triggers the action
- [ ] Tap flips the card; a tiny accidental move still counts as a tap
- [ ] Undo from the toast, the header button and (with a keyboard) `Ctrl+Z`
- [ ] The page does not scroll or bounce while dragging; no pull-to-refresh
- [ ] Dragging from the middle of the card does not trigger the system "back" gesture
- [ ] The on-screen keyboard does not cover the fields of the task form
- [ ] Dark mode (system setting) looks right and stays readable
- [ ] Rotating the screen keeps the layout usable
- [ ] Cards created through the form, with long content (long title and description, many tags, high priority already overdue) and with the virtual keyboard open: the card is visible, can be dragged and flipped, and the deck keeps working after several actions in a row (use `?debug=gestures`)
- [ ] In the task form, the keyboard action key goes to the next field (title → description...) and only the last field submits
- [ ] No horizontal scrolling or cut-off content at 320, 360 and 390 px wide (empty deck, cards, every sheet open, toast visible, settings), in light and dark themes and with the system text size enlarged
- [ ] Screen reader (TalkBack / VoiceOver): card name, flip state, actions and
      announcements are read

Calendar and reminders script:

- [ ] Export one task (back of the card) and all tasks (Settings) and open the downloaded `.ics` from the phone's downloads
- [ ] Import it into the phone's calendar app (Google Calendar or Apple Calendar): the time is the one shown in the app, the all-day tasks are all-day, the alarm fires at the chosen time (09:00 for all-day), and a weekly task repeats
- [ ] Import the same file again: events are updated, not duplicated
- [ ] A monthly task on the 31st repeats on the last day of shorter months; one on the 30th shows only the next date with the note
- [ ] Change the phone's clock (or wait) to cross a deadline with the app open: the card changes to soon/overdue and the reminder appears once
- [ ] Complete a recurring task: "Rescheduled for <date>", the card stays with the new date, Undo restores it

Persistence script:

- [ ] Create a task, reload the page: the task is there
- [ ] Switch to another deck and change the language, reload: both are kept
- [ ] Create a task and immediately close the tab; reopen: the task is there
- [ ] Turn on airplane mode, create/complete tasks, reload: everything is kept (no network is used)
- [ ] Settings → Export backup: a `taskdeck-backup-YYYY-MM-DD.json` file is downloaded and "Last backup" updates
- [ ] Clear the site data in the browser settings, reopen: first-run screen
- [ ] Settings → Import the exported file: summary, confirmation, data back; Undo works
- [ ] Private/incognito window: the "data will not be saved" warning appears and export works

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

## Calendar export (.ics) design

Checked against RFC 5545 (sections 3.1, 3.3.5, 3.3.10, 3.3.11, 3.6.1, 3.6.6, 3.8.1.9,
3.8.4.7, 3.8.6.3, 3.8.7.2) before writing the builder (`src/calendar/ics.ts`, pure).

- **VEVENT, not VTODO.** Phone calendar apps show and alert on events; most ignore
  VTODO. The trade-off: the calendar does not know the task is "done", and completing a
  task does not remove it there (export again to update it).
- **Stable UID** `<task id>@taskdeck`: importing again updates the event instead of
  duplicating it (in apps that honor UID). **DTSTAMP** is the export time, in UTC.
- **Floating local time.** A due with a time becomes `DTSTART:20261007T093000` (no `Z`,
  no `TZID`) lasting 15 minutes: "09:30 wherever the device is", the same wall-clock
  meaning as in the app. A date-only due becomes an all-day event (`VALUE=DATE`).
- **Alarms** are `DISPLAY` alarms relative to the start (`-PT15M`, `-PT1H`, `-P1D`, `PT0S`).
  For all-day events relative triggers count from 00:00 of the day, so the alarm is set
  for 09:00 of the day (`PT9H`), or 09:00 of the day before for "1 day" (`-PT15H`).
- **PRIORITY** 1 / 5 / 9 for high / medium / low (RFC: 1-4 high, 5 medium, 6-9 low).
- **Recurrence.** Due-anchored repetitions become `RRULE:FREQ=DAILY|WEEKLY|MONTHLY;INTERVAL=n`.
  Monthly: day 1-28 `BYMONTHDAY=n`; day 31 `BYMONTHDAY=-1` (the last day, which is exactly
  "31, or the last day of a shorter month"). For days 29 and 30 the RFC-exact form
  (`BYMONTHDAY=28,..,n;BYSETPOS=-1`) exists, but ical.js ignores `BYSETPOS` there and
  would create several events a month, so those export **only the next date**, with a
  note in the description. Repetitions counted **from completion** have no calendar
  equivalent: only the next date is exported, and the description says so.
- **Format**: CRLF line ends, folding at 75 octets that never splits a UTF-8 character
  (accents, emoji), TEXT escaping of backslash, `;`, `,` and newlines, events ordered by task id.
- **Validation with an independent parser**: [ical.js](https://github.com/kewisch/ical.js)
  (devDependency, v2.2.1; maintained by the Thunderbird calendar maintainer, ships
  TypeScript types) parses a varied sample and every field must match: text with
  special characters, start, duration, all-day dates, alarm, priority, categories and
  rules. It also expands the rules, and the dates are compared with the domain's own
  `nextDue`. It is what revealed the `BYSETPOS` problem above.

## Reminders design

Reminders work **only while the app is open** (no service worker or system
notifications yet). `diffDueBands` (domain) compares each task's urgency band with the
previous snapshot as the clock ticks (`useNow`: every 30 s and when the tab becomes
visible); `src/ui/reminders.ts` applies the rules: nothing on load, grouped changes,
one summary for what changed while the tab was hidden, no repeats for the same task
and band, and no reminder for a change caused by editing the due date.

## Known limitations

- **The undo history is not saved.** Reloading keeps the data but forgets what can be
  undone.
- **Two tabs: the last write wins.** Each tab saves its full snapshot; changes made in
  one tab are overwritten by the other's next save. There is no cross-tab sync yet.
- **iOS may delete the data of sites that are not used for a while** (and private
  modes delete it when closed). Mitigations: install the PWA (stage 5), which iOS
  treats more conservatively, and export backups.
- **No sync between devices**; moving data means export + import.
- Persistent storage is only available in secure contexts and the browser may refuse
  it; the status is shown in Settings.
- Gestures, layout and IndexedDB have only been tested in jsdom/fake-indexeddb so far
  (see "Manual QA").
- The bundle is about 160 kB gzip (React + Motion + zod + idb). Motion's `LazyMotion`
  and code-splitting the sheets could cut it later.
- **No alarm when the app is closed.** In-app reminders need the app open; calendar
  alarms only exist once the `.ics` is imported into a calendar app. System
  notifications are stage 6.
- **DST.** Wall-clock due dates follow the device's zone. A local time that does not
  exist (the hour skipped when DST starts) or happens twice is resolved by JavaScript
  `Date` in the app, and by each calendar app for the floating times in the `.ics`
  (usually the next valid time / the first occurrence). Not specifically tested.
- **Monthly on the 29th or 30th** exports only the next date to calendars (see the
  calendar design above); the 31st exports as "last day of the month". Inside the app
  all of them repeat correctly.
- An `.ics` with no task has no event, which parsers accept but the RFC grammar does
  not (it asks for at least one component), so the app never offers that download.
- Exported events are snapshots: completing, editing or deleting a task in the app does
  not change the calendar until the file is exported and imported again.
- Monthly recurrences anchored on `'completion'` use plain month addition (31 Jan →
  28 Feb → 28 Mar).

## Roadmap

1. Domain core (done)
2. Card UI with gestures, buttons/keyboard and undo (done)
3. Decks, tags, editing, local persistence and JSON backup (done)
4. Due dates and recurrence in the UI, in-app reminders, `.ics` export (done)
5. Installable PWA, offline, Playwright end-to-end tests (real drag, and no horizontal overflow at 320/360 px), deploy
6. Optional: Capacitor/Android packaging with local notifications
