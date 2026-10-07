# Known limitations

[← Back to the README](../README.md)

## Known limitations

- **"Today" is the local civil day** of the device (midnight to midnight). There is no
  configurable start of the day (e.g. 4:00 for night owls): a card completed at 00:30
  counts for the new day.
- **The tutorial must follow the features**: its texts and practice describe the
  current actions; any change to gestures, buttons or Scheduled must update it.
- **No demonstration animation**: the illustrations are static and the practice is
  driven by the person, never by a moving "ghost" gesture.
- **Snooze is only "until tomorrow"**: there is no free date ("snooze until Friday");
  snoozing again the next day is the way to push further.
- **No history or streaks**: progress counts only today's completions; there is no
  record of past days and no streak counter.
- **Days of the week only every 1 week, on a fixed calendar** (anchored on the due
  date). "Every 2 weeks on Monday" or "from completion" with days are not supported.
- **Hidden repeating cards are counted per deck**: "Scheduled (N)" and the progress
  follow the active deck; the tag filter only affects the deck itself.
- **Alarms only through the calendar app.** taskdeck cannot alert when it is closed;
  the only alarm outside the app is the one in an imported `.ics` event.
- **Reminders only with the app open** (and visible; a hidden tab gets one summary when
  it comes back).
- **iOS may delete the data of sites that are not installed** after a while without
  use (and private modes delete it when closed). Installing the app and exporting
  backups are the mitigations.
- **No sync between devices**; moving data means export + import.
- **Native date pickers**: the date field is the browser's own and looks different on
  each platform (only the time field was replaced).
- **Safari/iOS and Firefox are not tested**: Playwright runs Chromium only, and no
  manual check has been done in them.
- **The undo history is not saved.** Reloading keeps the data but forgets what can be
  undone.
- **Two tabs: the last write wins.** Each tab saves its full snapshot; changes made in
  one tab are overwritten by the other's next save. There is no cross-tab sync yet.
- Persistent storage is only available in secure contexts and the browser may refuse
  it; the status is shown in Settings.
- The bundle is about 182 kB gzip (JS 180 + workbox-window 2.2; CSS 5.4). Motion's
  `LazyMotion` and code-splitting the sheets could cut it.
- `og:image` points to `/og.png` (1200x630), which does not exist yet: link previews
  show no image until it is made (see "Pending").
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
