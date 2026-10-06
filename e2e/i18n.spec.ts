import { expect, test } from '@playwright/test'
import { openFirstRun, openSettings } from './helpers.ts'

test('?lang=en shows the app in English, with <html lang="en">', async ({ page }) => {
  await page.goto('/?lang=en')

  await expect(page.getByRole('heading', { name: 'Welcome to taskdeck' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Load sample tasks' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'New task' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('<html lang> follows the language chosen in the app', async ({ page }) => {
  await openFirstRun(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')

  const settings = await openSettings(page)
  await settings.getByRole('radio', { name: 'English' }).check()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})
