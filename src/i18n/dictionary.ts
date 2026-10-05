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
    readonly ariaLabel: (title: string, due: string, priority: string) => string
  }
  readonly toast: {
    readonly completed: string
    readonly postponed: string
    readonly removed: string
  }
  readonly announce: {
    readonly completed: (title: string) => string
    readonly postponed: (title: string) => string
    readonly removed: (title: string) => string
    readonly added: (title: string) => string
    readonly undone: string
    readonly redone: string
    readonly empty: string
  }
  readonly empty: {
    readonly title: string
    readonly body: string
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
  readonly errorScreen: {
    readonly title: string
    readonly body: string
    readonly reload: string
    readonly details: string
  }
  readonly form: {
    readonly title: string
    readonly titleLabel: string
    readonly descriptionLabel: string
    readonly priorityLabel: string
    readonly dateLabel: string
    readonly timeLabel: string
    readonly optional: string
    readonly save: string
    readonly cancel: string
    readonly close: string
    readonly errors: {
      readonly titleRequired: string
      readonly titleTooLong: (max: number) => string
      readonly descriptionTooLong: (max: number) => string
      readonly invalidDate: string
      readonly invalidTime: string
      readonly timeWithoutDate: string
      readonly generic: string
    }
  }
}
