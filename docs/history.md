# Project history

[← Back to the README](../README.md)

How taskdeck was built, in the order the work was done.

1. Domain core: pure schemas, dates, urgency, recurrence and actions with an injected clock.
2. Card UI with gestures, buttons/keyboard and undo.
3. Decks, tags, editing, local persistence (IndexedDB, validated, with quarantine) and JSON backup.
4. Due dates and recurrence in the UI, in-app reminders, `.ics` export.
5. Installable PWA, offline, update prompt, HH:mm time field, Playwright end-to-end tests, metadata, deploy on Vercel.
6. Behaviour package: shortcuts legend on pointer devices only, collapsible tag filter, repeating cards only on their day with a Scheduled sheet and daily progress, days of the week in recurrences.
7. Themes (auto, dark, light, lilac, pastel, neon).
8. Snooze until tomorrow with swipe down, the "Later" naming and honest empty states.
9. The "How to use" tutorial with an isolated practice deck.

After step 5 the core was considered complete; the later packages were added on request.
