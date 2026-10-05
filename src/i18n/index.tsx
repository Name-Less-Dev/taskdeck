import { createContext, useContext, useEffect, type ReactNode } from 'react'
import type { Dictionary, Locale } from './dictionary.ts'
import { en } from './en.ts'
import { ptBR } from './pt-BR.ts'

export type { Dictionary, Locale } from './dictionary.ts'
export { detectLocale, isLocaleForcedByUrl, resolveLocale } from './locale.ts'
export type { LanguageSetting } from './locale.ts'

export const dictionaries: Readonly<Record<Locale, Dictionary>> = { 'pt-BR': ptBR, en }

export interface I18n {
  readonly locale: Locale
  readonly t: Dictionary
}

const I18nContext = createContext<I18n>({ locale: 'pt-BR', t: ptBR })

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return <I18nContext value={{ locale, t: dictionaries[locale] }}>{children}</I18nContext>
}

/** Current locale and its dictionary (pt-BR outside a provider). */
export function useI18n(): I18n {
  return useContext(I18nContext)
}
