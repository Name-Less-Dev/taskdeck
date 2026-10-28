import { expect, test } from '@playwright/test'
import { addTask, liveRegion, openFirstRun, startEmpty, topCard } from './helpers.ts'

// The legend shows only with (hover: hover) and (pointer: fine): the desktop projects
// (Chromium, Firefox, WebKit) yes, the Pixel 7 no. Each test applies to one device class.
test('the keyboard shortcuts legend shows on desktop and the shortcuts work', async ({ page }, testInfo) => {
  test.skip(testInfo.project.use.isMobile === true, 'desktop only: a fine pointer and hover')
  await openFirstRun(page)
  await startEmpty(page)
  await addTask(page, { title: 'Com teclado' })

  const legend = page.getByText('Atalhos', { exact: true })
  await expect(legend).toBeVisible()
  await legend.click()
  await expect(page.getByText('Virar a carta')).toBeVisible()

  await topCard(page).focus()
  await page.keyboard.press('ArrowRight')
  await expect(liveRegion(page)).toContainText('Tarefa concluída: Com teclado.')
})

test('the keyboard shortcuts legend is hidden on a touch phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.use.isMobile !== true, 'mobile only: coarse pointer, no hover')
  await openFirstRun(page)
  await startEmpty(page)

  await expect(page.getByText('Atalhos', { exact: true })).toBeHidden()
  await expect(page.getByRole('group').filter({ hasText: 'Atalhos' })).toHaveCount(0)
})
