import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { dialog, loadSamples, openFirstRun, openSettings } from './helpers.ts'

/**
 * axe (via @axe-core/playwright) on the current screen. Fails on "serious"
 * or "critical" violations; "minor" and "moderate" ones are reported in the
 * message only. No rule is disabled.
 */
async function expectNoSeriousViolations(page: Page, screen: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  )
  const summary = blocking.map((violation) => `${violation.id} (${String(violation.impact)}): ${violation.help}`)
  expect(summary, `axe on "${screen}"`).toEqual([])
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`main screens have no serious or critical axe violations (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme })
    await openFirstRun(page)
    await expectNoSeriousViolations(page, 'first run')

    await loadSamples(page)
    await expectNoSeriousViolations(page, 'deck')

    await page.locator('[data-top-card]').click()
    await expect(page.getByRole('button', { name: /^Editar/ })).toBeVisible()
    await expectNoSeriousViolations(page, 'card back')

    await page.getByRole('button', { name: 'Nova tarefa' }).click()
    await dialog(page, 'Nova tarefa').getByRole('checkbox', { name: 'Repetir esta tarefa' }).check()
    await expectNoSeriousViolations(page, 'task form')
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: /^Baralho:/ }).click()
    await expect(dialog(page, 'Baralhos')).toBeVisible()
    await expectNoSeriousViolations(page, 'decks sheet')
    await page.keyboard.press('Escape')

    await openSettings(page)
    await expectNoSeriousViolations(page, 'settings')
  })
}
