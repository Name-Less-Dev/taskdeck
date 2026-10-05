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
