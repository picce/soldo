import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// A fixed day, so the month, its name and the days left do not depend on when the tests run.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T10:00:00'))
})

async function typeAmount(page: Page, keys: string[]) {
  const keypad = page.getByRole('group', { name: 'Tastierino' })
  for (const key of keys)
    await keypad.getByRole('button', { name: key, exact: true }).click()
}

/** An expense from the quick add; returns the text of the «Salvato» notice. */
async function addExpense(page: Page, keys: string[], category: string) {
  await page.goto('/nuovo/uscita')
  await typeAmount(page, keys)
  await page.getByRole('button', { name: category, exact: true }).click()
  const notice = page.getByRole('status').filter({ hasText: 'Salvato' })
  await expect(notice).toBeVisible()
  return notice
}

/** Fills the budget page that is open and saves it; `once` keeps it to that month. */
async function saveBudget(page: Page, amount: string, once?: string) {
  await page.getByRole('textbox', { name: 'Importo al mese' }).fill(amount)
  if (once)
    await page.getByRole('button', { name: once, exact: true }).click()
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Budget' })).toBeVisible()
}

function totalCard(page: Page) {
  return page.getByRole('link', { name: /^Budget del mese/ })
}

function categoryRow(page: Page, name: string) {
  return page.getByRole('region', { name: 'Per categoria' }).getByRole('link', {
    name: new RegExp(`^${name}`),
  })
}

async function shiftMonth(page: Page, direction: 'Periodo precedente' | 'Periodo successivo', title: string) {
  await page.getByRole('button', { name: direction }).click()
  await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
}

test('a budget for the month and one for a category say what is left, and warn on the way', async ({ page }) => {
  await page.goto('/budget')
  await expect(page.getByText('Decidi quanto spendere')).toBeVisible()

  await page.getByRole('button', { name: 'Imposta un budget' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Budget del mese' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Budget del mese' })).toBeVisible()
  await expect(page.getByText('Da novembre 2026 in poi, finché non lo cambi.')).toBeVisible()
  await saveBudget(page, '100')
  await expect(totalCard(page)).toContainText('100,00 €')
  await expect(totalCard(page)).toContainText('Mancano 24 giorni: 4,16 € al giorno')

  await page.getByRole('button', { name: 'Aggiungi budget' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Spesa' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Budget: Spesa' })).toBeVisible()
  await saveBudget(page, '50')
  await expect(categoryRow(page, 'Spesa')).toContainText('0,00 € di 50,00 €')

  await expect(await addExpense(page, ['3', '0'], 'Spesa')).toHaveText('Salvato: −30,00 € · Spesa')
  await expect(await addExpense(page, ['1', '0'], 'Spesa')).toHaveText('Salvato: −10,00 € · Spesa. Budget di Spesa: 80% usato.')
  await expect(await addExpense(page, ['1', '5'], 'Spesa')).toHaveText('Salvato: −15,00 € · Spesa. Budget di Spesa superato di 5,00 €.')
  await expect(await addExpense(page, ['3', '0'], 'Casa')).toHaveText('Salvato: −30,00 € · Casa. Budget del mese: 85% usato.')

  await page.goto('/budget')
  await expect(totalCard(page)).toContainText('15,00 €')
  await expect(totalCard(page).getByRole('meter')).toHaveAttribute('aria-valuetext', '85% usato')
  const groceries = categoryRow(page, 'Spesa')
  await expect(groceries).toContainText('55,00 € di 50,00 €')
  await expect(groceries).toContainText(/5,00\s*oltre/)
  await expect(groceries.getByRole('meter')).toHaveAttribute('aria-valuetext', /^110% usato, oltre di 5,00/)
  await expect(page.getByText('Senza budget')).toBeVisible()
})

test('a budget repeats in the months after, one month can differ, and «Togli» ends it', async ({ page }) => {
  await page.goto('/budget')
  await page.getByRole('button', { name: 'Imposta un budget' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Budget del mese' }).click()
  await saveBudget(page, '1000')
  await page.getByRole('button', { name: 'Aggiungi budget' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Spesa' }).click()
  await saveBudget(page, '250')

  await shiftMonth(page, 'Periodo successivo', 'Dicembre 2026')
  await expect(page).toHaveURL(/mese=2026-12/)
  await expect(totalCard(page)).toContainText('1.000,00 €')
  await expect(totalCard(page)).not.toContainText('al giorno')

  await categoryRow(page, 'Spesa').click()
  await saveBudget(page, '400', 'Solo dicembre')
  await expect(page.getByRole('heading', { level: 2, name: 'Dicembre 2026' })).toBeVisible()
  await expect(categoryRow(page, 'Spesa')).toContainText('di 400,00 €')

  await shiftMonth(page, 'Periodo successivo', 'Gennaio 2027')
  await expect(categoryRow(page, 'Spesa')).toContainText('di 250,00 €')

  await totalCard(page).click()
  await page.getByRole('button', { name: 'Togli' }).click()
  await expect(page.getByRole('status')).toContainText('Budget del mese tolto da gennaio.')
  await expect(page.getByRole('heading', { level: 2, name: 'Gennaio 2027' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Imposta il budget del mese' })).toBeVisible()

  await shiftMonth(page, 'Periodo precedente', 'Dicembre 2026')
  await expect(totalCard(page)).toContainText('1.000,00 €')
})

test('«Annulla» brings back a budget taken away', async ({ page }) => {
  await page.goto('/budget')
  await page.getByRole('button', { name: 'Imposta un budget' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Spesa' }).click()
  await saveBudget(page, '200')
  await categoryRow(page, 'Spesa').click()
  await page.getByRole('button', { name: 'Togli' }).click()
  await expect(page.getByText('Decidi quanto spendere')).toBeVisible()
  await page.getByRole('status').getByRole('button', { name: 'Annulla' }).click()
  await expect(categoryRow(page, 'Spesa')).toContainText('di 200,00 €')
})
