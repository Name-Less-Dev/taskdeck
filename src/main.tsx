// Must stay the first import: the dev error overlay has to be listening
// before any other module can throw.
import './dev/install.ts'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary, ErrorScreen } from './components/ErrorBoundary.tsx'
import { detectLocale, I18nProvider } from './i18n/index.tsx'
import './index.css'
import { PwaProvider } from './pwa/PwaProvider.tsx'
import { Root } from './Root.tsx'

const container = document.getElementById('root')
if (container === null) {
  throw new Error('Missing #root element in index.html')
}

const locale = detectLocale({ search: window.location.search, language: navigator.language })

createRoot(container).render(
  <StrictMode>
    <I18nProvider locale={locale}>
      <ErrorBoundary fallback={(error) => <ErrorScreen error={error} />}>
        <PwaProvider>
          <Root />
        </PwaProvider>
      </ErrorBoundary>
    </I18nProvider>
  </StrictMode>,
)
