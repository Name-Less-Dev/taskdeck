import { expect, test, type Page } from '@playwright/test'
import { addTask, liveRegion, openFirstRun, startEmpty, topCard, topCardTitle } from './helpers.ts'

/** Drags the top card by (dx, dy) with real mouse events, in small steps. */
async function drag(page: Page, dx: number, dy: number): Promise<void> {
  const box = await topCard(page).boundingBox()
  if (box === null) throw new Error('top card is not visible')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 15 })
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await openFirstRun(page)
  await startEmpty(page)
  // Plain tasks (no due date, no repetition) so every swipe has one meaning.
  for (const title of ['Tarefa A', 'Tarefa B', 'Tarefa C', 'Tarefa D']) await addTask(page, { title })
})

test('dragging right completes the top card', async ({ page }) => {
  const title = await topCardTitle(page)

  await drag(page, 260, 0)

  await expect(page.getByText('Tarefa concluída', { exact: true })).toBeVisible()
  await expect(liveRegion(page)).toContainText(`Tarefa concluída: ${title}.`)
  expect(await topCardTitle(page)).not.toBe(title)
})

test('dragging left postpones the top card', async ({ page }) => {
  const title = await topCardTitle(page)

  await drag(page, -260, 0)

  await expect(page.getByText('Para mais tarde', { exact: true })).toBeVisible()
  await expect(liveRegion(page)).toContainText(`Para mais tarde: ${title}.`)
  expect(await topCardTitle(page)).not.toBe(title)
})

test('dragging up deletes the top card, and Undo brings it back', async ({ page }) => {
  const title = await topCardTitle(page)

  await drag(page, 0, -300)

  await expect(page.getByText('Tarefa apagada', { exact: true })).toBeVisible()
  await expect(liveRegion(page)).toContainText(`Tarefa apagada: ${title}.`)
  await page.getByTestId('undo-toast').getByRole('button', { name: 'Desfazer' }).click()
  await expect(liveRegion(page)).toContainText('Ação desfeita.')
  await expect(topCard(page)).toHaveAttribute('aria-label', new RegExp(`^${title}\\.`))
})

test('a short drag springs back and changes nothing', async ({ page }) => {
  const title = await topCardTitle(page)

  await drag(page, 30, 0)

  await expect(topCard(page)).toHaveAttribute('aria-label', new RegExp(`^${title}\\.`))
  // Spring-back ends at the origin (no transform offset left).
  await expect
    .poll(async () => topCard(page).evaluate((element) => getComputedStyle(element).transform))
    .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/)
  await expect(page.getByTestId('undo-toast')).toHaveCount(0)
  await expect(liveRegion(page)).not.toContainText('Tarefa concluída')
})
