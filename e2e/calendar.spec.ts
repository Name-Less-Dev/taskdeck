import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { addTask, liveRegion, openFirstRun, openSettings, startEmpty } from './helpers.ts'

test('exports an .ics file with CRLF lines and the task, then says how to use it', async ({ page }, testInfo) => {
  await openFirstRun(page)
  await startEmpty(page)
  await addTask(page, { title: 'Consulta no dentista', date: '2030-01-15', time: '14:30' })

  const settings = await openSettings(page)
  const downloading = page.waitForEvent('download')
  await settings.getByRole('button', { name: 'Exportar tarefas com prazo (.ics)' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^taskdeck-\d{4}-\d{2}-\d{2}\.ics$/)
  const file = testInfo.outputPath(download.suggestedFilename())
  await download.saveAs(file)
  const text = await readFile(file, 'utf8')

  expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
  expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true)
  // Every line break is CRLF.
  expect(text.replaceAll('\r\n', '')).not.toContain('\n')
  expect(text).toContain('\r\nSUMMARY:Consulta no dentista\r\n')
  expect(text).toContain('\r\nDTSTART:20300115T143000\r\n')

  await expect(page.getByTestId('undo-toast')).toHaveText('Arquivo baixado. Abra-o para adicionar ao calendário.')
  await expect(liveRegion(page)).toContainText('Arquivo baixado. Abra-o para adicionar ao calendário.')
})
