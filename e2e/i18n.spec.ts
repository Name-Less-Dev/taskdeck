import { expect, test } from '@playwright/test'

test('?lang=en shows the app in English', async ({ page }) => {
  await page.goto('/?lang=en')

  await expect(page.getByRole('heading', { name: 'Welcome to taskdeck' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Load sample tasks' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'New task' })).toBeVisible()
})
