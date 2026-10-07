import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { addTask, dialog, liveRegion, openFirstRun, startEmpty, topCard, topCardTitle } from './helpers.ts'

// Monday 5 Oct 2026, 10:00 in the browser's zone (America/Sao_Paulo, UTC-3).
const START = new Date('2026-10-05T10:00:00-03:00')

async function dragDown(page: Page, dy: number): Promise<void> {
  const box = await topCard(page).boundingBox()
  if (box === null) throw new Error('top card is not visible')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + dy, { steps: 15 })
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: START })
  await openFirstRun(page)
  await startEmpty(page)
  await addTask(page, { title: 'Ligar para o banco' })
  await addTask(page, { title: 'Ler um livro' })
})

test('dragging down leaves the card for tomorrow; it waits in "Para amanhã" and comes back the next day', async ({ page }) => {
  const title = await topCardTitle(page)
  const box = await topCard(page).boundingBox()

  await dragDown(page, Math.max(200, (box?.height ?? 400) * 0.4))

  await expect(liveRegion(page)).toContainText(`Adiada para amanhã: ${title}. Desfazer disponível.`)
  await expect(page.getByTestId('daily-progress')).toHaveText('0 de 1 hoje')
  await page.getByRole('button', { name: 'Agendadas: 1 carta' }).click()
  const sheet = dialog(page, 'Agendadas')
  await expect(sheet.getByRole('heading', { name: 'Para amanhã' })).toBeVisible()
  await expect(sheet.getByTestId('snoozed-item')).toContainText(title)
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()

  // Past midnight: the app checks the clock every 30 s.
  await page.clock.fastForward('14:01:00')

  await expect(liveRegion(page)).toContainText('Novas cartas para hoje: 1.')
  await expect(page.getByTestId('daily-progress')).toHaveText('0 de 2 hoje')
  await expect(page.getByRole('button', { name: /^Agendadas/ })).toHaveCount(0)
})

test('"Trazer para hoje" puts a card left for tomorrow back on the deck', async ({ page }) => {
  const title = await topCardTitle(page)
  await page.getByRole('button', { name: 'Amanhã' }).click()
  await expect(liveRegion(page)).toContainText(`Adiada para amanhã: ${title}.`)

  await page.getByRole('button', { name: 'Agendadas: 1 carta' }).click()
  await dialog(page, 'Agendadas').getByRole('button', { name: `Trazer para hoje: ${title}` }).click()

  await expect(liveRegion(page)).toContainText(`Trazida para hoje: ${title}. Desfazer disponível.`)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('daily-progress')).toHaveText('0 de 2 hoje')
})

test('when every card is left for tomorrow, the deck says so instead of "all done"', async ({ page }) => {
  await page.getByRole('button', { name: 'Amanhã' }).click()
  await expect(page.getByTestId('daily-progress')).toHaveText('0 de 1 hoje')
  await page.getByRole('button', { name: 'Amanhã' }).click()

  await expect(page.getByRole('heading', { name: 'Por hoje é só' })).toBeVisible()
  await expect(page.getByText('2 cartas ficaram para amanhã.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tudo feito por hoje' })).toHaveCount(0)
})

for (const width of [320, 360]) {
  test(`the four actions fit ${String(width)} px with 48 px targets`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 })
    const bar = page.getByRole('group', { name: 'Ações da carta' })

    await expect(bar.getByRole('button')).toHaveText(['Mais tarde', 'Amanhã', 'Apagar', 'Concluir'])
    for (const button of await bar.getByRole('button').all()) {
      const box = await button.boundingBox()
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(48)
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(48)
    }
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })
}
