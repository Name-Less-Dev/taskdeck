import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithI18n } from '../test/render.tsx'
import { PREFERENCE_PREFIX } from '../ui/preferences.ts'
import { TAG_FILTER_OPEN_PREFERENCE, TagFilterBar } from './TagFilterBar.tsx'

const COUNTS = [
  { tag: 'casa', count: 2 },
  { tag: 'lazer', count: 1 },
]
const KEY = PREFERENCE_PREFIX + TAG_FILTER_OPEN_PREFERENCE

function renderBar(activeTag: string | null = null, counts = COUNTS) {
  const onToggle = vi.fn()
  const result = renderWithI18n(<TagFilterBar counts={counts} activeTag={activeTag} onToggle={onToggle} />)
  return { ...result, onToggle }
}

const toggle = () => screen.getByRole('button', { name: /^Filtrar por tag/ })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TagFilterBar', () => {
  it('starts collapsed: the toggle controls a hidden bar', () => {
    renderBar()

    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    const bar = document.getElementById(toggle().getAttribute('aria-controls') ?? '')
    expect(bar?.tagName).toBe('NAV')
    expect(bar).not.toBeVisible()
    expect(screen.queryByRole('button', { name: 'casa, 2 tarefas' })).toBeNull()
  })

  it('opens and closes the bar, remembering the choice in localStorage', async () => {
    const { user, unmount } = renderBar()

    await user.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('navigation', { name: 'Filtrar por tag' })).toBeVisible()
    expect(window.localStorage.getItem(KEY)).toBe('true')
    unmount()

    renderBar()
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    await user.click(toggle())
    expect(window.localStorage.getItem(KEY)).toBe('false')
  })

  it('still works when localStorage throws (the choice lasts for the session)', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { user } = renderBar()

    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
  })

  it('does not exist when there are no tags', () => {
    renderBar(null, [])

    expect(screen.queryByRole('button', { name: /Filtrar por tag/ })).toBeNull()
  })

  it('with a filter on, shows an indicator and a dismissible chip outside the collapsed bar', async () => {
    const { user, onToggle } = renderBar('lazer')

    expect(toggle()).toHaveAccessibleName('Filtrar por tag (filtro ativo)')
    expect(screen.getByTestId('tag-filter-indicator')).toBeInTheDocument()
    const chip = screen.getByRole('button', { name: 'Remover o filtro #lazer' })
    expect(chip).toBeVisible()
    expect(chip).toHaveTextContent('tag: lazer')

    await user.click(chip)
    expect(onToggle).toHaveBeenCalledWith(null)
  })

  it('without a filter there is no indicator and no chip', () => {
    renderBar(null)

    expect(toggle()).toHaveAccessibleName('Filtrar por tag')
    expect(screen.queryByTestId('tag-filter-indicator')).toBeNull()
    expect(screen.queryByRole('button', { name: /Remover o filtro/ })).toBeNull()
  })
})
