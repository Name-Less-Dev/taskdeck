import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Locale } from '../i18n/index.tsx'
import { renderWithI18n } from '../test/render.tsx'
import { FINE_POINTER_QUERY } from '../ui/useFinePointer.ts'
import { HowToSheet } from './HowToSheet.tsx'

function renderSheet(locale: Locale = 'pt-BR') {
  const onClose = vi.fn()
  const result = renderWithI18n(<HowToSheet onClose={onClose} />, locale)
  return { ...result, onClose }
}

const progress = () => screen.getByTestId('how-to-progress')
const stepTitle = () => screen.getByRole('heading', { level: 3 })
const sheetRegion = () => screen.getByRole('status')

/** Answers the fine-pointer query as given; every other query is "no". */
function pointer(fine: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: fine && query === FINE_POINTER_QUERY,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('HowToSheet', () => {
  it('is a modal dialog that starts on step 1 of 5 with focus on "Próximo"', () => {
    renderSheet()

    expect(screen.getByRole('dialog', { name: 'Como usar' })).toHaveAttribute('aria-modal', 'true')
    expect(progress()).toHaveTextContent('Passo 1 de 5')
    expect(stepTitle()).toHaveTextContent('Uma carta por vez')
    expect(screen.getByRole('button', { name: 'Próximo' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Voltar' })).toBeNull()
  })

  it('goes forward and back through the five steps, announcing each one', async () => {
    const { user } = renderSheet()

    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(progress()).toHaveTextContent('Passo 2 de 5')
    expect(sheetRegion()).toHaveTextContent('Passo 2 de 5: Deslize para os lados')

    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(stepTitle()).toHaveTextContent('Repetições e prazos')
    expect(screen.getByRole('button', { name: 'Concluir' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(progress()).toHaveTextContent('Passo 4 de 5')
    expect(sheetRegion()).toHaveTextContent('Passo 4 de 5: Prefere botões?')
  })

  it('going back to step 1 keeps focus on a control that stays', async () => {
    const { user } = renderSheet()
    await user.click(screen.getByRole('button', { name: 'Próximo' }))

    await user.click(screen.getByRole('button', { name: 'Voltar' }))

    expect(screen.getByRole('button', { name: 'Próximo' })).toHaveFocus()
  })

  it.each([
    ['Concluir (last step)', 'finished'],
    ['Pular', 'skipped'],
    ['Fechar', 'closed'],
  ])('reports how it was left: %s', async (button, reason) => {
    const { user, onClose } = renderSheet()
    if (reason === 'finished') {
      for (let i = 0; i < 4; i += 1) await user.click(screen.getByRole('button', { name: 'Próximo' }))
    }

    await user.click(screen.getByRole('button', { name: button.split(' ')[0] }))

    expect(onClose).toHaveBeenCalledWith(reason)
  })

  it('closes on Escape', async () => {
    const { user, onClose } = renderSheet()

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledWith('closed')
  })

  it('draws every direction with an arrow and a word', async () => {
    const { user } = renderSheet()

    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByTestId('how-to-figure')).toHaveTextContent('← Mais tarde')
    expect(screen.getByTestId('how-to-figure')).toHaveTextContent('Concluir →')
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByTestId('how-to-figure')).toHaveTextContent('↑ Apagar')
    expect(screen.getByTestId('how-to-figure')).toHaveTextContent('↓ Amanhã')
  })

  it.each([
    [true, true],
    [false, false],
  ])('step 4 mentions the arrow keys only with a fine pointer (fine=%s)', async (fine, shown) => {
    pointer(fine)
    const { user } = renderSheet()

    for (let i = 0; i < 3; i += 1) await user.click(screen.getByRole('button', { name: 'Próximo' }))

    expect(stepTitle()).toHaveTextContent('Prefere botões?')
    expect(screen.queryByText('No computador, as setas do teclado também.') !== null).toBe(shown)
  })

  it('speaks English', async () => {
    const { user } = renderSheet('en')

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(progress()).toHaveTextContent('Step 2 of 5')
    expect(stepTitle()).toHaveTextContent('Swipe sideways')
  })
})
