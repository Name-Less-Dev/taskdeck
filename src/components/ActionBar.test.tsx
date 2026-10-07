import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithI18n } from '../test/render.tsx'
import { ActionBar } from './ActionBar.tsx'

describe('ActionBar', () => {
  it('offers Later, Tomorrow, Delete and Complete with visible labels, Complete on the right', () => {
    renderWithI18n(<ActionBar disabled={false} onAction={vi.fn()} />)

    const group = screen.getByRole('group', { name: 'Ações da carta' })
    expect(within(group).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Mais tarde',
      'Amanhã',
      'Apagar',
      'Concluir',
    ])
  })

  it('reports the action of each button', async () => {
    const onAction = vi.fn()
    const { user } = renderWithI18n(<ActionBar disabled={false} onAction={onAction} />)

    await user.click(screen.getByRole('button', { name: 'Mais tarde' }))
    await user.click(screen.getByRole('button', { name: 'Amanhã' }))
    await user.click(screen.getByRole('button', { name: 'Apagar' }))
    await user.click(screen.getByRole('button', { name: 'Concluir' }))

    expect(onAction.mock.calls).toEqual([['postpone'], ['snooze'], ['remove'], ['complete']])
  })

  it('disables every button when there is no card to act on', () => {
    renderWithI18n(<ActionBar disabled onAction={vi.fn()} />)

    for (const name of ['Mais tarde', 'Amanhã', 'Apagar', 'Concluir']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
  })

  it('lists the keyboard shortcuts in a collapsed "Atalhos" disclosure', () => {
    const { container } = renderWithI18n(<ActionBar disabled={false} onAction={vi.fn()} />)

    const details = container.querySelector('details')
    expect(details).not.toHaveAttribute('open')
    expect(within(details as HTMLElement).getByText('Atalhos')).toBeInTheDocument()
    expect(within(details as HTMLElement).getByText('Espaço')).toBeInTheDocument()
    expect(within(details as HTMLElement).getByText('↓')).toBeInTheDocument()
    expect(within(details as HTMLElement).getAllByText('Amanhã')).toHaveLength(1)
  })
})
