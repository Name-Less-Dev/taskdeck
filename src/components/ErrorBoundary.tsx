import { Component, useEffect, useRef, type ReactNode } from 'react'
import { useI18n } from '../i18n/index.tsx'
import styles from './ErrorBoundary.module.css'

interface ErrorBoundaryProps {
  readonly children: ReactNode
  readonly fallback: (error: unknown) => ReactNode
}

type ErrorBoundaryState = { readonly failed: false } | { readonly failed: true; readonly error: unknown }

/**
 * Root error boundary: a render error shows a recoverable screen instead of
 * React unmounting everything into a blank page. (React still logs the error.)
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { failed: true, error }
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback(this.state.error) : this.props.children
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`
  return String(error)
}

export interface ErrorScreenProps {
  readonly error: unknown
  readonly onReload?: () => void
  /** Shows the error text; defaults to development builds only. */
  readonly showDetails?: boolean
}

/** Accessible fallback: announced as an alert, with focus on "Reload". */
export function ErrorScreen({
  error,
  onReload = () => {
    window.location.reload()
  },
  showDetails = import.meta.env.DEV,
}: ErrorScreenProps) {
  const { t } = useI18n()
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    buttonRef.current?.focus()
  }, [])

  return (
    <main className={styles.screen}>
      <div className={styles.panel} role="alert" aria-labelledby="error-screen-title">
        <h1 id="error-screen-title" className={styles.title}>
          {t.errorScreen.title}
        </h1>
        <p className={styles.body}>{t.errorScreen.body}</p>
        <button ref={buttonRef} type="button" className={styles.reload} onClick={onReload}>
          {t.errorScreen.reload}
        </button>
        {showDetails && (
          <details className={styles.details}>
            <summary>{t.errorScreen.details}</summary>
            <pre>{describeError(error)}</pre>
          </details>
        )}
      </div>
    </main>
  )
}
