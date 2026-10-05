import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { I18nProvider, type Locale } from '../i18n/index.tsx'

/** Renders inside the i18n provider and returns a user-event instance. */
export function renderWithI18n(ui: ReactElement, locale: Locale = 'pt-BR') {
  const user = userEvent.setup()
  return { user, ...render(<I18nProvider locale={locale}>{ui}</I18nProvider>) }
}
