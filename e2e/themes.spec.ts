import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { dialog, expectNoHorizontalScroll, loadSamples, openFirstRun, openSettings } from './helpers.ts'

/** Saves a theme the way the app does (JSON in localStorage) before any page script runs. */
async function preferTheme(page: Page, theme: string): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem('taskdeck:ui:theme', JSON.stringify(value))
  }, theme)
}

const html = (page: Page) => page.locator('html')

test('data-theme is set by the <head> script, before React (even with no bundle at all)', async ({ page }) => {
  await preferTheme(page, 'neon')
  // Block every script file: only the inline script in index.html can run.
  await page.route('**/*.{js,tsx,ts}', (route) => route.abort())

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(html(page)).toHaveAttribute('data-theme', 'neon')
  await expect(page.locator('#root')).toBeEmpty()
  // The stylesheet already paints the neon background.
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(10, 10, 15)')
})

test('"auto" follows the system colour scheme as it changes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await openFirstRun(page)
  await expect(html(page)).toHaveAttribute('data-theme', 'light')

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(html(page)).toHaveAttribute('data-theme', 'dark')

  await page.emulateMedia({ colorScheme: 'light' })
  await expect(html(page)).toHaveAttribute('data-theme', 'light')
})

test('choosing a theme in Settings applies it, updates theme-color and survives a reload', async ({ page }) => {
  await openFirstRun(page)
  const settings = await openSettings(page)

  await settings.getByRole('radio', { name: 'Neon' }).check()

  await expect(html(page)).toHaveAttribute('data-theme', 'neon')
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', '#0a0a0f')
  await page.reload()
  await expect(html(page)).toHaveAttribute('data-theme', 'neon')
})

const EXPECTED_SCHEME = { light: 'light', dark: 'dark', lilac: 'light', pastel: 'light', neon: 'dark' } as const

for (const [theme, scheme] of Object.entries(EXPECTED_SCHEME)) {
  test(`${theme}: color-scheme is ${scheme} and nothing scrolls sideways at 320 px`, async ({ page }) => {
    await preferTheme(page, theme)
    await page.setViewportSize({ width: 320, height: 700 })
    await openFirstRun(page)

    await expect(html(page)).toHaveAttribute('data-theme', theme)
    expect(await html(page).evaluate((element) => getComputedStyle(element).colorScheme)).toBe(scheme)
    await loadSamples(page)
    await expectNoHorizontalScroll(page, `${theme}: deck`)
    await openSettings(page)
    await expectNoHorizontalScroll(page, `${theme}: settings`)
  })
}

async function expectNoSeriousViolations(page: Page, screen: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const blocking = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
  expect(
    blocking.map((violation) => `${violation.id}: ${violation.help}`),
    `axe on "${screen}"`,
  ).toEqual([])
}

for (const theme of ['dark', 'pastel', 'neon']) {
  test(`${theme}: no serious or critical axe violations on the main screens`, async ({ page }) => {
    await preferTheme(page, theme)
    await openFirstRun(page)
    await expectNoSeriousViolations(page, 'first run')

    await loadSamples(page)
    await expectNoSeriousViolations(page, 'deck')

    await page.getByRole('button', { name: 'Nova tarefa' }).click()
    await dialog(page, 'Nova tarefa').getByRole('checkbox', { name: 'Repetir esta tarefa' }).check()
    await expectNoSeriousViolations(page, 'task form')
    await page.keyboard.press('Escape')

    await openSettings(page)
    await expectNoSeriousViolations(page, 'settings')
  })
}
