import type { Priority, Recurrence } from '../domain/index.ts'

export const LOCALES = ['pt-BR', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export interface PluralForms {
  readonly one: string
  readonly other: string
}

/** Picks the CLDR plural form for `count` and replaces "{n}" with it. */
export function plural(locale: Locale, count: number, forms: PluralForms): string {
  const form = new Intl.PluralRules(locale).select(count) === 'one' ? forms.one : forms.other
  return form.replace('{n}', String(count))
}

/**
 * Every UI string. Both dictionaries are typed against this interface, so a
 * missing or extra key is a compile error. Strings that depend on numbers are
 * functions so each language handles its own plural rules and word order.
 */
export interface Dictionary {
  readonly locale: Locale
  readonly app: {
    readonly name: string
    readonly deckLabel: string
    readonly historyLabel: string
  }
  readonly actions: {
    readonly complete: string
    readonly postpone: string
    readonly remove: string
    readonly undo: string
    readonly redo: string
    readonly add: string
    readonly actionsLabel: string
  }
  readonly priority: Readonly<Record<Priority, string>> & { readonly label: string }
  readonly due: {
    readonly pendingDays: (days: number) => string
    readonly none: string
    readonly today: string
    readonly tomorrow: string
    readonly overdueNow: string
    readonly overdueMinutes: (minutes: number) => string
    readonly overdueHours: (hours: number) => string
    readonly overdueDays: (days: number) => string
    readonly soonMinutes: (minutes: number) => string
    readonly soonHours: (hours: number, minutes: number) => string
    readonly inDays: (days: number) => string
  }
  readonly recurrence: {
    readonly every: (unit: Recurrence['unit'], every: number) => string
    readonly fromCompletion: string
    readonly fromDue: string
  }
  readonly card: {
    readonly front: string
    readonly back: string
    readonly flipHint: string
    readonly description: string
    readonly noDescription: string
    readonly dueLabel: string
    readonly recurrenceLabel: string
    readonly postponedLabel: string
    readonly postponedBadge: (days: number) => string
    readonly postponedCount: (days: number) => string
    readonly ariaLabel: (title: string, due: string, priority: string, deck?: string) => string
    readonly edit: string
    readonly editLabel: (title: string) => string
    readonly tagsLabel: string
  }
  readonly toast: {
    readonly completed: string
    readonly postponed: string
    readonly removed: string
    readonly deckCreated: string
    readonly deckRenamed: string
    readonly deckRemoved: string
    readonly taskUpdated: string
    readonly imported: string
    readonly completedUntil: (date: string) => string
  }
  readonly announce: {
    readonly completed: (title: string) => string
    readonly postponed: (title: string) => string
    readonly removed: (title: string) => string
    readonly added: (title: string) => string
    readonly samplesLoaded: (count: number) => string
    readonly deckSelected: (name: string) => string
    readonly taskUpdated: (title: string) => string
    readonly completedUntil: (title: string, date: string) => string
    readonly newCards: (count: number) => string
    readonly tagFilter: (tag: string, count: number) => string
    readonly tagFilterCleared: string
    readonly imported: (decks: number, tasks: number) => string
    readonly exported: string
    readonly languageChanged: string
    readonly deckCreated: (name: string) => string
    readonly deckRenamed: (from: string, to: string) => string
    readonly deckRemoved: (name: string, taskCount: number) => string
    readonly undone: string
    readonly redone: string
    readonly empty: string
  }
  readonly empty: {
    readonly title: string
    readonly body: string
  }
  readonly scheduled: {
    readonly open: (count: number) => string
    readonly openLabel: (count: number) => string
    readonly title: string
    readonly empty: string
    readonly next: (date: string) => string
    readonly completeNow: string
    readonly completeNowLabel: (title: string) => string
    readonly removeLabel: (title: string) => string
  }
  readonly day: {
    readonly doneTitle: string
    readonly doneBody: string
    readonly nothingTitle: string
    readonly nothingBody: string
    readonly upcoming: (count: number) => string
  }
  readonly progress: {
    readonly today: (done: number, total: number) => string
  }
  readonly shortcuts: {
    readonly summary: string
    readonly spaceKey: string
    readonly flip: string
    readonly complete: string
    readonly postpone: string
    readonly remove: string
    readonly undo: string
    readonly redo: string
  }
  readonly tags: {
    readonly label: string
    readonly hint: string
    readonly removeLabel: (tag: string) => string
    readonly more: (count: number) => string
    readonly moreLabel: (count: number) => string
    readonly filterLabel: string
    readonly filterOn: string
    readonly chip: (tag: string) => string
    readonly removeFilter: (tag: string) => string
    readonly filterButton: (tag: string, count: number) => string
    readonly clear: string
    readonly emptyTitle: (tag: string) => string
    readonly emptyBody: string
    readonly clearFilter: string
    readonly errors: {
      readonly tooLong: (max: number) => string
      readonly tooMany: (max: number) => string
    }
  }
  readonly decks: {
    readonly switcherPrefix: string
    readonly allDecks: string
    readonly sheetTitle: string
    readonly activeCount: (count: number) => string
    readonly select: (name: string) => string
    readonly rename: string
    readonly renameLabel: (name: string) => string
    readonly remove: string
    readonly removeLabel: (name: string) => string
    readonly save: string
    readonly cancel: string
    readonly nameLabel: string
    readonly newDeckLabel: string
    readonly create: string
    readonly confirmRemoveTitle: (name: string) => string
    readonly confirmRemoveBody: (taskCount: number) => string
    readonly confirmRemove: string
    readonly lastDeck: string
    readonly cardLabel: string
    readonly errors: {
      readonly required: string
      readonly tooLong: (max: number) => string
      readonly duplicate: string
    }
  }
  readonly settings: {
    readonly open: string
    readonly title: string
    readonly languageLegend: string
    readonly languageAuto: string
    readonly languagePt: string
    readonly languageEn: string
    readonly languageForcedByUrl: string
    readonly storageHeading: string
    readonly persistentLabel: string
    readonly persistentYes: string
    readonly persistentNo: string
    readonly persistentUnavailable: string
    readonly persistentChecking: string
    readonly memoryMode: string
    readonly lastBackupLabel: string
    readonly never: string
    readonly backupAdvice: string
    readonly export: string
    readonly importLabel: string
    readonly importSummary: (decks: number, tasks: number) => string
    readonly importConfirm: string
    readonly importReplace: string
    readonly importCancel: string
    readonly orphansRecovered: (count: number, deckName: string) => string
    readonly defaultDeckCreated: (deckName: string) => string
    readonly quarantine: (count: number) => string
    readonly errors: {
      readonly invalidJson: string
      readonly wrongFormat: string
      readonly newerVersion: (version: number) => string
      readonly missingMigration: (version: number) => string
      readonly schema: (path: string) => string
      readonly duplicateIds: (entity: 'deck' | 'task', ids: string) => string
      readonly unreadable: string
    }
  }
  readonly startup: {
    readonly loading: string
    readonly generalDeck: string
    readonly recoveredDeck: string
  }
  readonly storage: {
    readonly memoryWarning: string
    readonly saveFailed: string
    readonly retry: string
  }
  readonly firstRun: {
    readonly title: string
    readonly body: string
    readonly loadSamples: string
    readonly startEmpty: string
  }
  readonly readOnly: {
    readonly title: string
    readonly newerVersion: (found: number, supported: number) => string
    readonly missingMigration: (found: number) => string
    readonly untouched: string
    readonly found: (decks: number, tasks: number) => string
    readonly export: string
  }
  readonly errorScreen: {
    readonly title: string
    readonly body: string
    readonly reload: string
    readonly details: string
  }
  readonly calendar: {
    readonly addToCalendar: string
    readonly addToCalendarLabel: (title: string) => string
    readonly heading: string
    readonly alarmLabel: string
    readonly alarms: Readonly<Record<'none' | 'at-time' | '15m' | '1h' | '1d', string>>
    readonly activeDeckOnly: string
    readonly export: string
    readonly exportable: (count: number) => string
    readonly nothingToExport: string
    readonly limits: string
    readonly completionNote: string
    readonly monthEndNote: (day: number) => string
    readonly exported: (count: number) => string
    readonly downloaded: string
  }
  readonly pwa: {
    readonly updateAvailable: string
    readonly update: string
    readonly later: string
    readonly heading: string
    readonly install: string
    readonly iosHint: string
    readonly dismissHint: string
    readonly offlineReady: string
    readonly offlineNotReady: string
  }
  readonly reminders: {
    readonly soon: (title: string, when: string) => string
    readonly overdue: (title: string) => string
    readonly group: (count: number) => string
    readonly awayOverdue: (count: number) => string
    readonly awayMixed: (count: number) => string
    readonly dismiss: string
  }
  readonly repeat: {
    readonly legend: string
    readonly toggle: string
    readonly everyLabel: string
    readonly unitLabel: string
    readonly units: Readonly<Record<'day' | 'week' | 'month', (count: number) => string>>
    readonly anchorLegend: string
    readonly anchorDue: string
    readonly anchorDueHint: string
    readonly anchorCompletion: string
    readonly anchorCompletionHint: string
    readonly everyInvalid: string
  }
  readonly form: {
    readonly title: string
    readonly titleLabel: string
    readonly descriptionLabel: string
    readonly priorityLabel: string
    readonly dateLabel: string
    readonly timeLabel: string
    readonly timePlaceholder: string
    readonly timeHint: string
    readonly timeShortcuts: string
    readonly optional: string
    readonly save: string
    readonly editTitle: string
    readonly saveChanges: string
    readonly deckLabel: string
    readonly cancel: string
    readonly close: string
    readonly errors: {
      readonly titleRequired: string
      readonly titleTooLong: (max: number) => string
      readonly descriptionTooLong: (max: number) => string
      readonly invalidDate: string
      readonly invalidTime: string
      readonly timeWithoutDate: string
      readonly recurrenceNeedsDue: string
      readonly generic: string
    }
  }
}
