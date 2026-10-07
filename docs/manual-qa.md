# Manual QA

[← Back to the README](../README.md)

## Verified manually

Only what has actually been seen on a device:

- An exported `.ics` event imported into the calendar app of an Android phone, with
  its time, a daily repetition and an alarm; **the alarm fired**.

Everything else in the scripts below is still unchecked.

## Manual QA on a phone

The checklists below need a real device. Run `npm run dev -- --host`, then open the
"Network" URL Vite prints (e.g. `http://192.168.0.10:5173`) on a phone on the same
Wi-Fi. On Windows, allow Node.js through the firewall for private networks when asked.

**`http://<LAN IP>` is not a secure context.** Browsers only treat HTTPS and
`localhost` as secure, so on the phone over plain HTTP: `crypto.randomUUID` does not
exist (ids come from `createId()`, which falls back to `getRandomValues`), there is no
service worker and no PWA install, and `navigator.storage` (persistent storage) is
missing, so Settings shows "unavailable". IndexedDB itself works. **PWA and
persistent-storage testing require HTTPS**: use the Vercel URL. In
development, uncaught errors are printed on the page by a small overlay.

Gestures and layout:

- [ ] Swipe right, left, up and down: overlay grows with the distance, card leaves, action applies
- [ ] Swipe down ("Tomorrow"): the card is in Scheduled > "For tomorrow" and back the next morning; dragging down never scrolls or refreshes the page
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
- [ ] Complete a recurring task: "Done. Back on `<date>`", the card leaves the deck and is listed in "Scheduled", Undo restores it
- [ ] Leave the app open past midnight (or come back the next day): the repeating card is back and "New cards for today" is announced once
- [ ] Pick Mon/Wed/Fri in the form: "First time" shows the right day, and the calendar app repeats on those days only
- [ ] Phone: the shortcuts legend is not shown; the tag filter opens and closes and stays as left after a reload

PWA and time field script (on <https://taskdeck-flax.vercel.app>):

- [ ] Android Chrome: Settings → "Install app" installs it; the icon (maskable) looks right on the home screen; it opens standalone, and the install button is gone there
- [ ] iPhone Safari: the "Share > Add to Home Screen" hint appears, "Dismiss tip" hides it for good; installed, the apple-touch-icon is used
- [ ] After one visit, airplane mode, reopen the installed app: it opens, and tasks can be created and are kept
- [ ] Settings shows "Ready to use offline"
- [ ] Deploy a new version: "New version available" appears (not over an open form); "Later" hides it; "Update" reloads into the new version
- [ ] The time field opens the numeric keyboard, "0930" becomes "09:30", the shortcuts work, and nothing is cut off at 320 px
- [ ] Theme colour of the browser bar follows light/dark

Persistence script:

- [ ] Create a task, reload the page: the task is there
- [ ] Switch to another deck and change the language, reload: both are kept
- [ ] Create a task and immediately close the tab; reopen: the task is there
- [ ] Turn on airplane mode, create/complete tasks, reload: everything is kept (no network is used)
- [ ] Settings → Export backup: a `taskdeck-backup-YYYY-MM-DD.json` file is downloaded and "Last backup" updates
- [ ] Clear the site data in the browser settings, reopen: first-run screen
- [ ] Settings → Import the exported file: summary, confirmation, data back; Undo works
- [ ] Private/incognito window: the "data will not be saved" warning appears and export works
