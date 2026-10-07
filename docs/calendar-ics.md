# Calendar export (.ics)

[← Back to the README](../README.md)

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
- **Days of the week** become `RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR` (INTERVAL defaults to
  1, the only interval allowed with days); DTSTART is the first valid day. ical.js
  expands 8 weeks of them exactly like the domain.
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
