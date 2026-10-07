# Bugs found and fixed

[← Back to the README](../README.md)

## Fixed bugs worth remembering

- **Enter in the task form created the task** (step 3 of the [history](history.md)). The virtual keyboard's
  action key sends Enter, and Enter in a single-line field implicitly submits a
  `<form>`; `enterkeyhint` only changes the key's label. The form now handles Enter:
  next field in single-line fields, submit on the last one (the time, or the
  repetition anchor when the task repeats), new line in the
  description, Ctrl/Cmd+Enter submits anywhere, nothing while an IME is composing.
- **Invisible card / "frozen" deck after creating cards in the form** (same step), two
  independent causes, both reproduced before fixing:
  1. *Layout.* The shell was a 3-row grid (`auto 1fr auto`); that step added more rows
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

- **A change made right before a reload was lost** (found by the Playwright
  persistence test). Saves are debounced by 300 ms and flushed on `pagehide`, but in
  Chromium the flushed transaction never committed before the page went away (with
  1 s of wait the test passed). Fix: `tx.commit()` once every write is queued, with a
  unit test that the commit happens and the e2e test as the reproduction.
