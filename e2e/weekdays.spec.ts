import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { dialog, openFirstRun, openSettings, startEmpty, topCard, topCardTitle } from './helpers.ts'

// Monday 5 Oct 2026, 10:00 in the browser's zone (America/Sao_Paulo, UTC-3).
const START = new Date('2026-10-05T10:00:00-03:00')

test('a Mon/Wed/Fri task from the form shows its days and exports BYDAY', async ({ page }, testInfo) => {
  await page.clock.install({ time: START })
  await openFirstRun(page)
  await startEmpty(page)

  await page.getByRole('button', { name: 'Nova tarefa' }).click()
  const form = dialog(page, 'Nova tarefa')
  await form.getByLabel('Título').fill('Academia')
  await form.getByLabel(/Data do prazo/).fill('2026-10-05')
  await form.getByLabel(/Hora do prazo/).fill('18:30')
  await form.getByRole('checkbox', { name: 'Repetir esta tarefa' }).check()
  for (const day of ['segunda-feira', 'quarta-feira', 'sexta-feira']) {
    await form.getByRole('button', { name: day, exact: true }).click()
  }
  await expect(form.getByRole('button', { name: 'quarta-feira', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(form.getByTestId('first-time')).toContainText('Primeira vez:')
  await form.getByRole('button', { name: 'Criar tarefa' }).click()
  await expect(form).toBeHidden()

  expect(await topCardTitle(page)).toBe('Academia')
  await expect(page.getByTestId('recurrence-badge')).toHaveText('seg., qua. e sex.')
  await topCard(page).click()
  await expect(topCard(page)).toHaveAccessibleDescription(/Toda semana: seg\., qua\. e sex\., contando do prazo/)

  const settings = await openSettings(page)
  const downloading = page.waitForEvent('download')
  await settings.getByRole('button', { name: 'Exportar tarefas com prazo (.ics)' }).click()
  const download = await downloading
  const file = testInfo.outputPath(download.suggestedFilename())
  await download.saveAs(file)
  const text = await readFile(file, 'utf8')

  expect(text).toContain('\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR\r\n')
  expect(text).toContain('\r\nDTSTART:20261005T183000\r\n')
})
