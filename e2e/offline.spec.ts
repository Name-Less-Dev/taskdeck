import { expect, test } from '@playwright/test'
import { addTask, dialog, openFirstRun, openSettings, startEmpty, topCardTitle } from './helpers.ts'

test('once the service worker is ready, the app opens and works offline', async ({ page, context }) => {
  await openFirstRun(page)
  await startEmpty(page)
  // Waits until a worker is active, i.e. its install step finished the precache.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  const settings = await openSettings(page)
  await expect(settings.getByTestId('offline-status')).toHaveText('Pronto para usar offline')
  await page.keyboard.press('Escape')
  await expect(dialog(page, 'Configurações')).toBeHidden()

  await context.setOffline(true)
  await page.reload()

  await expect(page.getByRole('button', { name: 'Nova tarefa' })).toBeVisible()
  await addTask(page, { title: 'Criada sem rede' })
  await page.reload()
  await expect(page.locator('[data-top-card]')).toBeVisible()
  expect(await topCardTitle(page)).toBe('Criada sem rede')
})
