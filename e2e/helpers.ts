import { expect, type Locator, type Page } from '@playwright/test'

/** Opens the app in a fresh context: IndexedDB is empty, so the first-run screen shows. */
export async function openFirstRun(page: Page, path = '/'): Promise<void> {
  await page.goto(path)
  await expect(page.getByRole('heading', { name: 'Bem-vindo ao taskdeck' })).toBeVisible()
}

export async function loadSamples(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Carregar tarefas de exemplo' }).click()
  await expect(topCard(page)).toBeVisible()
}

export async function startEmpty(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Começar do zero' }).click()
  await expect(page.getByRole('heading', { name: 'Bem-vindo ao taskdeck' })).toBeHidden()
}

export function topCard(page: Page): Locator {
  return page.locator('[data-top-card]')
}

/** The title of the top card, read from its accessible name ("Title. Due. Priority ..."). */
export async function topCardTitle(page: Page): Promise<string> {
  const label = (await topCard(page).getAttribute('aria-label')) ?? ''
  return label.split('. ')[0] ?? ''
}

/** The app's polite live region (screen-reader announcements). */
export function liveRegion(page: Page): Locator {
  return page.locator('[role="status"][aria-live="polite"]')
}

export function dialog(page: Page, name: string): Locator {
  return page.getByRole('dialog', { name })
}

export interface NewTask {
  readonly title: string
  readonly date?: string
  readonly time?: string
}

/** Creates a task through the form (button "Nova tarefa"). */
export async function addTask(page: Page, { title, date, time }: NewTask): Promise<void> {
  await page.getByRole('button', { name: 'Nova tarefa' }).click()
  const form = dialog(page, 'Nova tarefa')
  await form.getByLabel('Título').fill(title)
  if (date !== undefined) await form.getByLabel(/Data do prazo/).fill(date)
  if (time !== undefined) await form.getByLabel(/Hora do prazo/).fill(time)
  await form.getByRole('button', { name: 'Criar tarefa' }).click()
  await expect(form).toBeHidden()
  await expect(liveRegion(page)).toContainText(`Tarefa criada: ${title}.`)
}

export async function openSettings(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Configurações' }).click()
  const sheet = dialog(page, 'Configurações')
  await expect(sheet).toBeVisible()
  return sheet
}

/** No horizontal page scroll (the 320/360 px rule in CLAUDE.md). */
export async function expectNoHorizontalScroll(page: Page, state: string): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth, `horizontal scroll in "${state}"`).toBeLessThanOrEqual(clientWidth)
}
