# Features

[← Back to the README](../README.md)

Everything the app does, in detail.

## Features

- **Card deck** ordered by urgency (overdue → soon → today → tomorrow → this week →
  later → no due date). The top card is draggable; up to two more cards are drawn
  underneath.
- **Gestures**: right = complete, left = "Later" (bottom of the deck until the end of
  the day), down = "Tomorrow" (off the deck until tomorrow), up = delete, tap = flip to
  the back. Coloured overlays with icon and text grow as you drag.
- **Same actions without gestures**: Later / Tomorrow / Delete / Complete buttons in the
  thumb zone (icon over a short label, fitting 320 px), Undo / Redo in the header, and
  keyboard shortcuts.
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
- **Settings**: language (Automatic / Português / English), app (offline status, install), calendar export, persistent-storage status,
  last backup date, export/import, quarantined records.
- **Accessibility**: live region announcements, focus returned to the opener (or the
  deck) when sheets close, focus trapped in sheets, visible focus, AA contrast checked
  by a test, never colour alone, reduced-motion support.
- **Recurrence in the form**: a "Repeat" block (every N days/weeks/months, counted from
  the due date or from completion) to set, change or remove a task's repetition; a
  repeating task needs a due date. Cards show a short badge ("Toda semana") and the full
  rule on the back; completing one says "Done. Back on <date>" (undoable).
- **Deadline escalation**: border and background follow the band (soon amber, overdue
  red), always with an icon and text; "soon" pulses gently unless reduced motion is on.
- **In-app reminders**: when time moves a task into "soon" or "overdue" while the app is
  open, a discreet notice appears and is announced (grouped when several change; one
  summary after returning to a hidden tab; never repeated; Esc or button to dismiss).
- **Calendar export (.ics)**: "Calendar" on the back of a card exports that task;
  Settings exports every active task with a due date (or just the active deck), with
  an alarm setting (none, at the time, 15 min, 1 h, 1 day before; default 15 min).
- **Recurring cards only on their day**: a repeating card leaves the deck when it is
  completed and comes back on the day of its next date ("Done. Back on <date>").
  One-off tasks are never hidden, whatever their due date. The header reads "X of Y
  today"; "Scheduled (N)" opens a sheet with the waiting cards (next date, rule, deck;
  Complete now, Edit, Delete, all undoable). With nothing left for today the deck says
  "That's it for today. N cards are waiting for tomorrow." when cards were left for
  tomorrow (never "all done" then), "All done for today" after a completion or with
  scheduled cards (a small CSS celebration only after a completion, none with reduced
  motion), or "Nothing for today".
- **Tomorrow (snooze)**: swipe down, the Tomorrow button or ↓ hides the card until the
  next day without touching its due date; it waits in Scheduled > "For tomorrow" (with
  "Bring back today") and comes back on its own at midnight. Undoable, announced. When the day changes with the app open
  (or on return to the tab), the cards that wake up are announced once.
- **Days of the week**: a weekly repetition can run on chosen days (Mon/Wed/Fri,
  weekdays, weekends...), with "First time: <date>" before saving; exported to
  calendars as `BYDAY`.
- **How to use**: a five-step tutorial with a hands-on practice of the four actions,
  from Settings > Help ("How to use", with a help icon), from "See how it works" on the
  first-run screen, or with `?help=1`. It never opens on its own.
- **Themes**: Settings > Appearance offers Auto (follows the system, live), Dark,
  Light, Lilac, Pastel and Neon, each with a 3-colour swatch and its name; applied at
  once, announced, with "Restore default". No flash on load.
- **Collapsible tag filter**: "Filter by tag" opens the bar (collapsed by default,
  remembered per browser); an active filter shows an indicator and a dismissible
  "tag: X ×" chip.
- **Time field**: a 24 h "HH:mm" text field with a numeric keyboard (the native time
  picker was cut off on an Android phone): typing mask, "9:30" completed to "09:30" on
  leaving the field, the domain's validation (rejects 24:00, 12:60), and 09:00 / 12:00 /
  18:00 shortcuts. The date stays a native field.
- **After a calendar export** a notice says "File downloaded. Open it to add it to your
  calendar." (also announced).
- **Installable PWA, offline**: manifest and icons, a service worker that precaches the
  app, "Install app" in Settings (Chromium) or an iOS hint, "Ready to use offline" in
  Settings, and a "New version available · Update · Later" toast that never reloads on
  its own and never appears over an open sheet or form.
- **i18n**: pt-BR (default) and en; `?lang=en|pt-BR` in the address wins over the
  saved choice; `<html lang>` follows the language in use.

### Keyboard shortcuts (focus on the deck)

| Key | Action |
| --- | --- |
| `Enter` / `Space` | Flip the card |
| `E` | Edit the card |
| `→` | Complete |
| `←` | Later |
| `↓` | Tomorrow |
| `Delete` / `Backspace` | Delete |
| `Ctrl/⌘ + Z` | Undo |
| `Ctrl + Shift + Z` / `Ctrl + Y` | Redo |
