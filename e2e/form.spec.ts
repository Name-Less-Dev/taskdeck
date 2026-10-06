import { expect, test } from '@playwright/test'
import { dialog, liveRegion, openFirstRun, startEmpty, topCardTitle } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await openFirstRun(page)
  await startEmpty(page)
  await page.getByRole('button', { name: 'Nova tarefa' }).click()
  await expect(dialog(page, 'Nova tarefa')).toBeVisible()
})

test('Enter in the title moves to the next field without submitting', async ({ page }) => {
  const form = dialog(page, 'Nova tarefa')

  await form.getByLabel('Título').fill('Comprar pão')
  await page.keyboard.press('Enter')

  await expect(form.getByLabel(/Descrição/)).toBeFocused()
  await expect(form).toBeVisible()
})

test('Enter on the last field submits, with the typed time completed', async ({ page }) => {
  const form = dialog(page, 'Nova tarefa')
  await form.getByLabel('Título').fill('Reunião')
  await form.getByLabel(/Data do prazo/).fill('2030-01-15')
  const time = form.getByLabel(/Hora do prazo/)

  await time.click()
  await page.keyboard.type('9:30')
  await page.keyboard.press('Enter')

  await expect(form).toBeHidden()
  await expect(liveRegion(page)).toContainText('Tarefa criada: Reunião.')
  expect(await topCardTitle(page)).toBe('Reunião')
})

test('the time field masks digits, offers shortcuts and rejects invalid times', async ({ page }) => {
  const form = dialog(page, 'Nova tarefa')
  const time = form.getByLabel(/Hora do prazo/)

  await time.click()
  await page.keyboard.type('0930')
  await expect(time).toHaveValue('09:30')

  await form.getByRole('button', { name: '18:00' }).click()
  await expect(time).toHaveValue('18:00')

  await time.fill('')
  await time.click()
  await page.keyboard.type('2460')
  await form.getByLabel('Título').click()
  await expect(time).toHaveAttribute('aria-invalid', 'true')
  await expect(form.getByText('Informe uma hora válida (HH:mm).')).toBeVisible()
})

test('a repeating task without a due date shows an error', async ({ page }) => {
  const form = dialog(page, 'Nova tarefa')
  await form.getByLabel('Título').fill('Regar plantas')
  await form.getByRole('checkbox', { name: 'Repetir esta tarefa' }).check()

  await form.getByRole('button', { name: 'Criar tarefa' }).click()

  await expect(form.getByText('Uma tarefa recorrente precisa de uma data.')).toBeVisible()
  await expect(form.getByLabel(/Data do prazo/)).toHaveAttribute('aria-invalid', 'true')
  await expect(form.getByLabel(/Data do prazo/)).toBeFocused()
})
