import { expect, test } from '@playwright/test'
import { addTask, openFirstRun, openSettings, startEmpty, topCardTitle } from './helpers.ts'

test('export a backup, start over with empty site data, and import it', async ({ page, browser }, testInfo) => {
  await openFirstRun(page)
  await startEmpty(page)
  await addTask(page, { title: 'Vai no backup' })

  const settings = await openSettings(page)
  const downloading = page.waitForEvent('download')
  await settings.getByRole('button', { name: 'Exportar backup (.json)' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^taskdeck-backup-.*\.json$/)
  const file = testInfo.outputPath(download.suggestedFilename())
  await download.saveAs(file)

  // "Clearing the site data": a new browser context has its own, empty IndexedDB.
  const fresh = await browser.newContext(testInfo.project.use)
  const other = await fresh.newPage()
  await openFirstRun(other)
  const otherSettings = await openSettings(other)
  await otherSettings.getByLabel('Importar backup (.json)').setInputFiles(file)
  await otherSettings.getByRole('button', { name: 'Substituir meus dados' }).click()

  await expect(other.getByText('Dados importados', { exact: true })).toBeVisible()
  expect(await topCardTitle(other)).toBe('Vai no backup')
  await fresh.close()
})

test('an invalid file shows an error and changes nothing', async ({ page }) => {
  await openFirstRun(page)
  await startEmpty(page)
  await addTask(page, { title: 'Continua aqui' })

  const settings = await openSettings(page)
  await settings.getByLabel('Importar backup (.json)').setInputFiles({
    name: 'nao-e-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from('isto não é JSON'),
  })

  await expect(settings.getByText('O arquivo não é um JSON válido.')).toBeVisible()
  await expect(settings.getByRole('button', { name: 'Substituir meus dados' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  expect(await topCardTitle(page)).toBe('Continua aqui')
})
