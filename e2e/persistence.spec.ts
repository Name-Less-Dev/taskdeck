import { expect, test } from '@playwright/test'
import { addTask, dialog, openFirstRun, openSettings, startEmpty, topCardTitle } from './helpers.ts'

test('a created task is still there after a reload', async ({ page }) => {
  await openFirstRun(page)
  await startEmpty(page)
  await addTask(page, { title: 'Sobrevive ao reload' })

  await page.reload()

  await expect(page.locator('[data-top-card]')).toBeVisible()
  expect(await topCardTitle(page)).toBe('Sobrevive ao reload')
})

test('the active deck and the language survive a reload', async ({ page }) => {
  await openFirstRun(page)
  await startEmpty(page)

  await page.getByRole('button', { name: /^Baralho:/ }).click()
  const decks = dialog(page, 'Baralhos')
  await decks.getByLabel('Novo baralho').fill('Trabalho')
  await decks.getByRole('button', { name: 'Criar baralho' }).click()
  await decks.getByRole('button', { name: /^Trabalho/ }).click()
  await expect(page.getByRole('button', { name: 'Baralho: Trabalho' })).toBeVisible()

  const settings = await openSettings(page)
  await settings.getByRole('radio', { name: 'English' }).check()
  await expect(dialog(page, 'Settings')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.reload()

  await expect(page.getByRole('button', { name: 'Deck: Trabalho' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'New task' })).toBeVisible()
})
