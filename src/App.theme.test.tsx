import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App.tsx'
import { appProps } from './test/app.tsx'
import { renderWithI18n } from './test/render.tsx'
import { THEME_STORAGE_KEY } from './ui/theme.ts'

const DATA = { decks: [{ id: 'home', name: 'Casa' }], tasks: [] }
const root = document.documentElement

afterEach(() => {
  delete root.dataset.theme
  delete root.dataset.themeChoice
})

async function openAppearance(locale: 'pt-BR' | 'en' = 'pt-BR') {
  const result = renderWithI18n(<App {...appProps(DATA)} />, locale)
  await result.user.click(screen.getByRole('button', { name: locale === 'en' ? 'Settings' : 'Configurações' }))
  const group = screen.getByRole('group', { name: locale === 'en' ? 'Appearance' : 'Aparência' })
  return { ...result, group }
}

describe('Settings > Appearance', () => {
  it('lists every theme by name with a 3-colour swatch painted by that theme', async () => {
    const { group } = await openAppearance()

    expect(within(group).getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)).toEqual([
      'Automático',
      'Escuro',
      'Claro',
      'Lilás',
      'Pastel',
      'Neon',
    ])
    expect(within(group).getByRole('radio', { name: 'Automático' })).toBeChecked()
    const neon = within(group).getByTestId('theme-neon')
    expect(neon.querySelector('[data-theme="neon"]')?.children).toHaveLength(3)
    // Auto shows light and dark side by side.
    expect(within(group).getByTestId('theme-auto').querySelectorAll('[data-theme]')).toHaveLength(2)
  })

  it('applies a theme at once, saves it and announces it', async () => {
    const { user, group } = await openAppearance()

    await user.click(within(group).getByRole('radio', { name: 'Neon' }))

    expect(root.dataset.theme).toBe('neon')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('"neon"')
    expect(screen.getByRole('status')).toHaveTextContent('Tema Neon aplicado.')
  })

  it('works with the keyboard: arrow keys move between themes and apply them', async () => {
    const { user, group } = await openAppearance()
    within(group).getByRole('radio', { name: 'Automático' }).focus()

    await user.keyboard('{ArrowDown}')

    expect(within(group).getByRole('radio', { name: 'Escuro' })).toHaveFocus()
    expect(root.dataset.theme).toBe('dark')
  })

  it('"Restaurar padrão" goes back to auto, and is disabled when already there', async () => {
    const { user, group } = await openAppearance()
    const reset = within(group).getByRole('button', { name: 'Restaurar padrão' })
    expect(reset).toBeDisabled()

    await user.click(within(group).getByRole('radio', { name: 'Lilás' }))
    expect(root.dataset.theme).toBe('lilac')
    await user.click(reset)

    expect(within(group).getByRole('radio', { name: 'Automático' })).toBeChecked()
    expect(root.dataset.theme).toBe('light')
    expect(root.dataset.themeChoice).toBe('auto')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('"auto"')
    expect(screen.getByRole('status')).toHaveTextContent('Tema Automático aplicado.')
  })

  it('starts from the saved theme', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, '"pastel"')

    const { group } = await openAppearance()

    expect(within(group).getByRole('radio', { name: 'Pastel' })).toBeChecked()
    expect(root.dataset.theme).toBe('pastel')
  })

  it('names the themes in English', async () => {
    const { user, group } = await openAppearance('en')

    await user.click(within(group).getByRole('radio', { name: 'Lilac' }))

    expect(screen.getByRole('status')).toHaveTextContent('Lilac theme applied.')
    expect(within(group).getByRole('button', { name: 'Restore default' })).toBeEnabled()
  })
})
