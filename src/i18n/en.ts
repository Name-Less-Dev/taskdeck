import { plural, type Dictionary } from './dictionary.ts'

const p = (count: number, one: string, other: string) => plural('en', count, { one, other })

export const en: Dictionary = {
  locale: 'en',
  app: {
    name: 'taskdeck',
    deckLabel: 'Task deck',
    historyLabel: 'History',
  },
  actions: {
    complete: 'Complete',
    postpone: 'Postpone',
    remove: 'Delete',
    undo: 'Undo',
    redo: 'Redo',
    add: 'New task',
    actionsLabel: 'Card actions',
  },
  priority: {
    label: 'Priority',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  },
  due: {
    none: 'No due date',
    today: 'Today',
    tomorrow: 'Tomorrow',
    overdueNow: 'Overdue now',
    overdueMinutes: (n) => `Overdue by ${n} min`,
    overdueHours: (n) => `Overdue by ${n} h`,
    overdueDays: (n) => p(n, 'Overdue by {n} day', 'Overdue by {n} days'),
    soonMinutes: (n) => `In ${n} min`,
    soonHours: (h, m) => `In ${h} h` + (m > 0 ? ` ${m} min` : ''),
    inDays: (n) => p(n, 'In {n} day', 'In {n} days'),
  },
  recurrence: {
    every: (unit, n) => {
      switch (unit) {
        case 'day':
          return p(n, 'Every day', 'Every {n} days')
        case 'week':
          return p(n, 'Every week', 'Every {n} weeks')
        case 'month':
          return p(n, 'Every month', 'Every {n} months')
      }
    },
    fromCompletion: ', counted from completion',
  },
  card: {
    front: 'Front',
    back: 'Back',
    flipHint: 'Tap to flip',
    description: 'Description',
    noDescription: 'No description.',
    dueLabel: 'Due',
    recurrenceLabel: 'Repeats',
    postponedLabel: 'Postponed',
    postponedBadge: (n) => p(n, 'postponed {n} day', 'postponed {n} days'),
    postponedCount: (n) => (n === 0 ? 'Never' : p(n, '{n} day', '{n} days')),
    ariaLabel: (title, due, priority) => `${title}. ${due}. ${priority} priority.`,
  },
  toast: {
    completed: 'Task completed',
    postponed: 'Task postponed',
    removed: 'Task deleted',
  },
  announce: {
    completed: (title) => `Task completed: ${title}. Undo available.`,
    postponed: (title) => `Task postponed: ${title}. Undo available.`,
    removed: (title) => `Task deleted: ${title}. Undo available.`,
    added: (title) => `Task created: ${title}.`,
    samplesLoaded: (n) => p(n, '{n} sample task loaded.', '{n} sample tasks loaded.'),
    undone: 'Action undone.',
    redone: 'Action redone.',
    empty: 'No tasks in the deck.',
  },
  empty: {
    title: 'All caught up!',
    body: 'There are no tasks in the deck. Create one with the New task button.',
  },
  shortcuts: {
    summary: 'Shortcuts',
    spaceKey: 'Space',
    flip: 'Flip the card',
    complete: 'Complete',
    postpone: 'Postpone',
    remove: 'Delete',
    undo: 'Undo',
    redo: 'Redo',
  },
  startup: {
    loading: 'Loading your tasks…',
    generalDeck: 'General',
    recoveredDeck: 'Recovered',
  },
  storage: {
    memoryWarning: 'Your data will not be saved in this browser. Export a backup before leaving.',
    saveFailed: 'Your latest changes could not be saved.',
    retry: 'Try again',
  },
  firstRun: {
    title: 'Welcome to taskdeck',
    body: 'Start with a few sample tasks to try the gestures, or with an empty deck.',
    loadSamples: 'Load sample tasks',
    startEmpty: 'Start from scratch',
  },
  readOnly: {
    title: 'Data from a newer version',
    newerVersion: (found, supported) =>
      `This data was saved by a newer version of taskdeck (format ${found}). This version only understands format ${supported}.`,
    missingMigration: (found) => `This data uses an old format (${found}) that this version cannot convert.`,
    untouched: 'Nothing was changed: the app is read-only. Update the app or export a copy of the data.',
    found: (decks, tasks) => `Found: ${p(decks, '{n} deck record', '{n} deck records')}, ${p(tasks, '{n} task record', '{n} task records')}.`,
    export: 'Export what was found',
  },
  errorScreen: {
    title: 'Something went wrong',
    body: 'taskdeck hit an error and could not continue. Reload the page to try again.',
    reload: 'Reload',
    details: 'Technical details',
  },
  form: {
    title: 'New task',
    titleLabel: 'Title',
    descriptionLabel: 'Description',
    priorityLabel: 'Priority',
    dateLabel: 'Due date',
    timeLabel: 'Due time',
    optional: '(optional)',
    save: 'Create task',
    cancel: 'Cancel',
    close: 'Close',
    errors: {
      titleRequired: 'Enter a title.',
      titleTooLong: (max) => `Use at most ${max} characters.`,
      descriptionTooLong: (max) => `Use at most ${max} characters.`,
      invalidDate: 'Enter a valid date.',
      invalidTime: 'Enter a valid time (HH:mm).',
      timeWithoutDate: 'Pick a date to use a time.',
      generic: 'Invalid value.',
    },
  },
}
