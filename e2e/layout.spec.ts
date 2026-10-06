import { expect, test } from '@playwright/test'
import { dialog, expectNoHorizontalScroll, loadSamples, openFirstRun, openSettings } from './helpers.ts'

for (const width of [320, 360]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`no horizontal scroll at ${String(width)} px (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme })
      await page.setViewportSize({ width, height: 700 })

      await openFirstRun(page)
      await expectNoHorizontalScroll(page, 'first run')

      await loadSamples(page)
      await expectNoHorizontalScroll(page, 'sample tasks')

      await page.getByRole('button', { name: 'Nova tarefa' }).click()
      const form = dialog(page, 'Nova tarefa')
      await expect(form).toBeVisible()
      // Repetition open: the widest version of the form.
      await form.getByRole('checkbox', { name: 'Repetir esta tarefa' }).check()
      await expect(form.getByLabel('A cada')).toBeVisible()
      await expectNoHorizontalScroll(page, 'task form')
      await page.keyboard.press('Escape')
      await expect(form).toBeHidden()

      await page.getByRole('button', { name: /^Baralho:/ }).click()
      await expect(dialog(page, 'Baralhos')).toBeVisible()
      await expectNoHorizontalScroll(page, 'decks sheet')
      await page.keyboard.press('Escape')
      await expect(dialog(page, 'Baralhos')).toBeHidden()

      await openSettings(page)
      await expectNoHorizontalScroll(page, 'settings')
    })
  }
}
