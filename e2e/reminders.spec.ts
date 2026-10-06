import { expect, test } from '@playwright/test'
import { addTask, liveRegion, openFirstRun, startEmpty } from './helpers.ts'

// Playwright's controlled clock (page.clock, https://playwright.dev/docs/clock).
// 10:00 in the browser's zone (America/Sao_Paulo, UTC-3, in playwright.config.ts).
const START = new Date('2026-10-05T10:00:00-03:00')

test('a reminder appears when a task becomes overdue with the app open', async ({ page }) => {
  await page.clock.install({ time: START })
  await openFirstRun(page)
  await startEmpty(page)
  await addTask(page, { title: 'Pagar o boleto', date: '2026-10-05', time: '10:02' })
  await expect(page.getByTestId('reminder-toast')).toHaveCount(0)

  // The app checks the clock every 30 s; jump past the deadline.
  await page.clock.fastForward('03:00')

  await expect(page.getByTestId('reminder-toast')).toHaveText('Venceu: Pagar o boleto')
  await expect(liveRegion(page)).toContainText('Venceu: Pagar o boleto')
})
