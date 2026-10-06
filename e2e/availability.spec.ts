import { expect, test } from '@playwright/test'
import { dialog, liveRegion, openFirstRun, startEmpty, topCardTitle } from './helpers.ts'

// Playwright's controlled clock; 10:00 in the browser's zone (America/Sao_Paulo, UTC-3).
const START = new Date('2026-10-05T10:00:00-03:00')

test('a completed recurring card waits in "Agendadas" and comes back on its day', async ({ page }) => {
  await page.clock.install({ time: START })
  await openFirstRun(page)
  await startEmpty(page)

  await page.getByRole('button', { name: 'Nova tarefa' }).click()
  const form = dialog(page, 'Nova tarefa')
  await form.getByLabel('Título').fill('Regar as plantas')
  await form.getByLabel(/Data do prazo/).fill('2026-10-05')
  await form.getByRole('checkbox', { name: 'Repetir esta tarefa' }).check()
  await form.getByLabel('Unidade').selectOption('day')
  await form.getByRole('button', { name: 'Criar tarefa' }).click()
  await expect(form).toBeHidden()
  expect(await topCardTitle(page)).toBe('Regar as plantas')
  await expect(page.getByTestId('daily-progress')).toHaveText('0 de 1 hoje')

  await page.getByRole('button', { name: 'Concluir' }).click()

  await expect(page.getByRole('heading', { name: 'Tudo feito por hoje' })).toBeVisible()
  await expect(page.getByTestId('daily-progress')).toHaveText('1 de 1 hoje')
  await expect(liveRegion(page)).toContainText('Regar as plantas: concluída. Volta em')
  await page.getByRole('button', { name: 'Agendadas: 1 carta' }).click()
  const scheduled = dialog(page, 'Agendadas')
  await expect(scheduled.getByRole('heading', { name: 'Regar as plantas' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(scheduled).toBeHidden()

  // Jump past midnight: the app checks the clock every 30 s.
  await page.clock.fastForward('14:01:00')

  await expect(liveRegion(page)).toContainText('Novas cartas para hoje: 1.')
  await expect(page.locator('[data-top-card]')).toBeVisible()
  expect(await topCardTitle(page)).toBe('Regar as plantas')
  await expect(page.getByTestId('daily-progress')).toHaveText('0 de 1 hoje')
  await expect(page.getByRole('button', { name: /^Agendadas/ })).toHaveCount(0)
})
