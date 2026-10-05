import { LOCALES, type Locale } from './dictionary.ts'

function isLocale(value: string | null): value is Locale {
  return LOCALES.some((locale) => locale === value)
}

/**
 * `?lang=en` or `?lang=pt-BR` wins; otherwise any "pt*" browser language
 * means pt-BR and everything else falls back to English.
 */
export function detectLocale({ search, language }: { search: string; language: string }): Locale {
  const forced = new URLSearchParams(search).get('lang')
  if (isLocale(forced)) return forced
  return language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
}

/** Language preference stored in settings. */
export type LanguageSetting = 'auto' | Locale

/** True when the URL forces a language (?lang=en|pt-BR); it beats the stored setting. */
export function isLocaleForcedByUrl(search: string): boolean {
  return isLocale(new URLSearchParams(search).get('lang'))
}

/** ?lang= wins, then the stored setting, then the browser language. */
export function resolveLocale({
  search,
  language,
  setting,
}: {
  search: string
  language: string
  setting: LanguageSetting
}): Locale {
  if (isLocaleForcedByUrl(search) || setting === 'auto') return detectLocale({ search, language })
  return setting
}
