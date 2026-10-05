import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { createDemoTasks } from './demo/seed.ts'
import { detectLocale, I18nProvider } from './i18n/index.tsx'
import './index.css'

const container = document.getElementById('root')
if (container === null) {
  throw new Error('Missing #root element in index.html')
}

const locale = detectLocale({ search: window.location.search, language: navigator.language })

createRoot(container).render(
  <StrictMode>
    <I18nProvider locale={locale}>
      <App initialTasks={createDemoTasks(new Date())} />
    </I18nProvider>
  </StrictMode>,
)
