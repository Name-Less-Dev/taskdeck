import { expect, test } from '@playwright/test'
import { dialog, liveRegion, openFirstRun, startEmpty, topCardTitle } from './helpers.ts'

async function addTagged(page: import('@playwright/test').Page, title: string, tag: string): Promise<void> {
  await page.getByRole('button', { name: 'Nova tarefa' }).click()
  const form = dialog(page, 'Nova tarefa')
  await form.getByLabel('Título').fill(title)
  await form.getByLabel('Tags').fill(tag)
  await form.getByRole('button', { name: 'Criar tarefa' }).click()
  await expect(form).toBeHidden()
}

test('the tag filter is collapsed by default, filters, and remembers being open', async ({ page }) => {
  await openFirstRun(page)
  await startEmpty(page)
  await expect(page.getByRole('button', { name: /^Filtrar por tag/ })).toHaveCount(0)
  await addTagged(page, 'Ler um livro', 'lazer')
  await addTagged(page, 'Lavar a louça', 'casa')

  const toggle = page.getByRole('button', { name: /^Filtrar por tag/ })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('navigation', { name: 'Filtrar por tag' })).toBeHidden()

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: 'lazer, 1 tarefa' }).click()
  await expect(liveRegion(page)).toContainText('Filtro #lazer: 1 tarefa.')
  expect(await topCardTitle(page)).toBe('Ler um livro')

  // Collapse it: the chip keeps the active filter visible and dismissible.
  await toggle.click()
  await expect(toggle).toHaveAccessibleName('Filtrar por tag (filtro ativo)')
  await page.getByRole('button', { name: 'Remover o filtro #lazer' }).click()
  await expect(liveRegion(page)).toContainText('Filtro de tag removido.')

  // The open/closed state is an interface preference (localStorage), kept on reload.
  await toggle.click()
  await page.reload()
  await expect(page.getByRole('button', { name: /^Filtrar por tag/ })).toHaveAttribute('aria-expanded', 'true')
})
