import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { dialog, expectNoHorizontalScroll, openFirstRun, openSettings, startEmpty } from './helpers.ts'

async function expectNoSeriousViolations(page: Page, screen: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(
    blocking.map((v) => `${v.id}: ${v.help}`),
    `axe on "${screen}"`,
  ).toEqual([])
}

test('opens from Settings > Help, walks the five steps and returns to Settings', async ({ page }) => {
  await openFirstRun(page)
  await startEmpty(page)
  const settings = await openSettings(page)

  await settings.getByRole('button', { name: 'Como usar: abrir o tutorial' }).click()
  const sheet = dialog(page, 'Como usar')
  await expect(sheet.getByText('Passo 1 de 5')).toBeVisible()
  for (const title of ['Deslize para os lados', 'Para cima e para baixo', 'Prefere botões?', 'Repetições e prazos']) {
    await sheet.getByRole('button', { name: 'Próximo' }).click()
    await expect(sheet.getByRole('heading', { name: title })).toBeVisible()
  }
  await sheet.getByRole('button', { name: 'Concluir' }).click()

  await expect(sheet).toBeHidden()
  await expect(dialog(page, 'Configurações').getByRole('button', { name: 'Como usar: abrir o tutorial' })).toBeFocused()
})

test('step 4 mentions the arrow keys only where there is a fine pointer', async ({ page }, testInfo) => {
  await page.goto('/?help=1')
  const sheet = dialog(page, 'Como usar')
  for (let i = 0; i < 3; i += 1) await sheet.getByRole('button', { name: 'Próximo' }).click()

  const hint = sheet.getByText('No computador, as setas do teclado também.')
  if (testInfo.project.name === 'desktop') await expect(hint).toBeVisible()
  else await expect(hint).toHaveCount(0)
})

test('?help=1 opens it on load, and it never opens without asking', async ({ page }) => {
  await page.goto('/?help=1')
  await expect(dialog(page, 'Como usar')).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Bem-vindo ao taskdeck' })).toBeVisible()
  await expect(dialog(page, 'Como usar')).toHaveCount(0)
})

test('the first-run screen offers "Ver como funciona"', async ({ page }) => {
  await openFirstRun(page)

  await page.getByRole('button', { name: 'Ver como funciona' }).click()

  await expect(dialog(page, 'Como usar')).toBeVisible()
})

for (const width of [320, 360]) {
  test(`no horizontal scroll and no serious axe violations at ${String(width)} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 })
    await page.goto('/?help=1')
    const sheet = dialog(page, 'Como usar')
    await expect(sheet).toBeVisible()

    for (let step = 1; step <= 5; step += 1) {
      await expect(sheet.getByTestId('how-to-progress')).toHaveText(`Passo ${String(step)} de 5`)
      await expectNoHorizontalScroll(page, `how-to step ${String(step)}`)
      if (step === 1 || step === 3) await expectNoSeriousViolations(page, `how-to step ${String(step)}`)
      if (step < 5) await sheet.getByRole('button', { name: 'Próximo' }).click()
    }
  })
}
