import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { addTask, dialog, expectNoHorizontalScroll, liveRegion, openFirstRun, openSettings, startEmpty, topCardTitle } from './helpers.ts'

/** Everything in the app's IndexedDB (database "taskdeck"), read directly. */
async function storedData(page: Page): Promise<unknown> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('taskdeck')
        request.onerror = () => {
          reject(new Error('cannot open IndexedDB'))
        }
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(['decks', 'tasks', 'meta'], 'readonly')
          const out: Record<string, unknown> = {}
          for (const name of ['decks', 'tasks', 'meta'] as const) {
            const all = tx.objectStore(name).getAll()
            all.onsuccess = () => {
              out[name] = all.result
            }
          }
          tx.oncomplete = () => {
            db.close()
            resolve(out)
          }
        }
      }),
  )
}

/** Drags the practice card with real mouse events, in small steps. */
async function drag(page: Page, practice: Locator, dx: number, dy: number): Promise<void> {
  const box = await practice.locator('[data-top-card]').boundingBox()
  if (box === null) throw new Error('no practice card')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 15 })
  await page.mouse.up()
}

async function openPractice(page: Page): Promise<{ sheet: Locator; practice: Locator }> {
  const settings = await openSettings(page)
  await settings.getByRole('button', { name: 'Como usar: abrir o tutorial' }).click()
  const sheet = dialog(page, 'Como usar')
  await sheet.getByRole('button', { name: 'Próximo' }).click()
  const practice = sheet.getByTestId('practice-deck')
  await expect(practice).toContainText('Prática: nada disso é salvo')
  return { sheet, practice }
}

test('the practice is completed with mouse drags and leaves the real task and storage untouched', async ({ page }) => {
  await openFirstRun(page)
  await startEmpty(page)
  await addTask(page, { title: 'Tarefa de verdade' })
  // Wait for the real task's own autosave before taking the reference snapshot.
  await expect
    .poll(async () => ((await storedData(page)) as { tasks: unknown[] }).tasks.length)
    .toBe(1)
  const before = await storedData(page)
  const appAnnouncement = await liveRegion(page).first().textContent()

  const { sheet, practice } = await openPractice(page)
  await drag(page, practice, 220, 0)
  await expect(practice).toContainText('Agora, mais tarde: deslize para a esquerda.')
  await drag(page, practice, -220, 0)
  await expect(sheet.getByTestId('how-to-progress')).toHaveText('Passo 3 de 5')
  await expect(practice).toContainText('Adie para amanhã: deslize para baixo.')
  await drag(page, practice, 0, 160)
  await expect(practice).toContainText('Agora apague: deslize para cima.')
  await drag(page, practice, 0, -160)
  await expect(sheet.getByTestId('how-to-progress')).toHaveText('Passo 4 de 5')

  // Nothing real changed: the stored data, the app's live region and the deck.
  expect(await storedData(page)).toEqual(before)
  expect(await liveRegion(page).first().textContent()).toBe(appAnnouncement)
  await sheet.getByRole('button', { name: 'Pular' }).click()
  await page.keyboard.press('Escape')
  expect(await topCardTitle(page)).toBe('Tarefa de verdade')
})

test('the practice can be completed with the buttons only', async ({ page }) => {
  await page.goto('/?help=1')
  const sheet = dialog(page, 'Como usar')
  await sheet.getByRole('button', { name: 'Próximo' }).click()
  const practice = sheet.getByTestId('practice-deck')

  for (const [button, next] of [
    ['Concluir', 'Agora, mais tarde'],
    ['Mais tarde', 'Adie para amanhã'],
    ['Amanhã', 'Agora apague'],
  ] as const) {
    await practice.getByRole('button', { name: button, exact: true }).click()
    await expect(practice).toContainText(next)
  }
  await practice.getByRole('button', { name: 'Apagar', exact: true }).click()

  await expect(sheet.getByTestId('how-to-progress')).toHaveText('Passo 4 de 5')
})

test('a different action gets a kind note and "Tentar de novo"', async ({ page }) => {
  await page.goto('/?help=1')
  const sheet = dialog(page, 'Como usar')
  await sheet.getByRole('button', { name: 'Próximo' }).click()
  const practice = sheet.getByTestId('practice-deck')

  await practice.getByRole('button', { name: 'Amanhã', exact: true }).click()

  await expect(practice).toContainText('Isso adiou a carta para amanhã. Agora tente concluir.')
  await practice.getByRole('button', { name: 'Tentar de novo' }).click()
  await expect(practice.locator('[data-top-card]')).toBeVisible()
})

for (const width of [320, 360]) {
  test(`the practice fits ${String(width)} px and has no serious axe violations`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 })
    await page.goto('/?help=1')
    const sheet = dialog(page, 'Como usar')
    await sheet.getByRole('button', { name: 'Próximo' }).click()
    await expect(sheet.getByTestId('practice-deck')).toBeVisible()

    await expectNoHorizontalScroll(page, 'practice')
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.help}`),
    ).toEqual([])
  })
}
