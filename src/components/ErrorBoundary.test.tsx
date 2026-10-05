import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithI18n } from '../test/render.tsx'
import { ErrorBoundary, ErrorScreen } from './ErrorBoundary.tsx'

function Boom(): never {
  throw new TypeError('crypto.randomUUID is not a function')
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs every caught render error; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders its children when nothing fails', () => {
    renderWithI18n(
      <ErrorBoundary fallback={() => <p>fallback</p>}>
        <p>deck</p>
      </ErrorBoundary>,
    )

    expect(screen.getByText('deck')).toBeInTheDocument()
    expect(screen.queryByText('fallback')).toBeNull()
  })

  it('replaces a crashed tree with an accessible alert and a focused "Recarregar" button', () => {
    const onReload = vi.fn()
    renderWithI18n(
      <ErrorBoundary fallback={(error) => <ErrorScreen error={error} onReload={onReload} />}>
        <Boom />
      </ErrorBoundary>,
    )

    const alert = screen.getByRole('alert', { name: 'Algo deu errado' })
    expect(alert).toHaveTextContent('Recarregue a página para tentar de novo.')
    const reload = screen.getByRole('button', { name: 'Recarregar' })
    expect(reload).toHaveFocus()
  })

  it('calls onReload when "Recarregar" is pressed', async () => {
    const onReload = vi.fn()
    const { user } = renderWithI18n(
      <ErrorBoundary fallback={(error) => <ErrorScreen error={error} onReload={onReload} />}>
        <Boom />
      </ErrorBoundary>,
    )

    await user.click(screen.getByRole('button', { name: 'Recarregar' }))

    expect(onReload).toHaveBeenCalledTimes(1)
  })

  it('shows the technical details only when asked to', () => {
    const { unmount } = renderWithI18n(<ErrorScreen error={new TypeError('boom')} showDetails />)
    expect(screen.getByText('Detalhes técnicos')).toBeInTheDocument()
    expect(screen.getByText(/TypeError: boom/)).toBeInTheDocument()
    unmount()

    renderWithI18n(<ErrorScreen error={new TypeError('boom')} showDetails={false} />)
    expect(screen.queryByText('Detalhes técnicos')).toBeNull()
  })

  it('describes non-Error values too', () => {
    renderWithI18n(<ErrorScreen error="plain string" showDetails />)

    expect(screen.getByText('plain string')).toBeInTheDocument()
  })

  it('is translated', () => {
    renderWithI18n(<ErrorScreen error={null} showDetails={false} />, 'en')

    expect(screen.getByRole('alert', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })
})
