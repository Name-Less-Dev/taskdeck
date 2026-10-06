import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithI18n } from '../test/render.tsx'
import { UpdateToast } from './UpdateToast.tsx'

function renderToast(visible = true) {
  const onUpdate = vi.fn()
  const onLater = vi.fn()
  const result = renderWithI18n(<UpdateToast visible={visible} onUpdate={onUpdate} onLater={onLater} />)
  return { ...result, onUpdate, onLater }
}

describe('UpdateToast', () => {
  it('offers "Atualizar" and "Depois" and calls each only when clicked', async () => {
    const { user, onUpdate, onLater } = renderToast()

    expect(screen.getByTestId('update-toast')).toHaveTextContent('Nova versão disponível')
    expect(onUpdate).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Depois' }))
    expect(onLater).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect(onUpdate).toHaveBeenCalledTimes(1)
  })

  it('does not take focus when it appears', () => {
    renderToast()

    expect(screen.getByRole('button', { name: 'Atualizar' })).not.toHaveFocus()
    expect(document.body).toHaveFocus()
  })

  it('renders nothing when not visible', () => {
    renderToast(false)

    expect(screen.queryByTestId('update-toast')).toBeNull()
  })
})
