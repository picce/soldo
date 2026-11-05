import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

async function addFromHome(page: Page, button: 'Uscita' | 'Entrata', keys: string[], category: string) {
  await page.getByRole('link', { name: button, exact: true }).click()
  const keypad = page.getByRole('group', { name: 'Tastierino' })
  for (const key of keys)
    await keypad.getByRole('button', { name: key, exact: true }).click()
  await page.getByRole('button', { name: category, exact: true }).click()
  // Back on the Home, which opened the editor.
  await expect(page.getByRole('tablist', { name: 'Periodo' })).toBeVisible()
}

test('sums the month and splits the expenses per category', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/Nessun movimento a \S+\./)).toBeVisible()

  await addFromHome(page, 'Uscita', ['1', '2', 'Virgola', '4'], 'Spesa')
  await addFromHome(page, 'Uscita', ['7', 'Virgola', '6'], 'Ristoranti')
  await addFromHome(page, 'Entrata', ['1', '0', '0'], 'Stipendio')

  const summary = page.getByRole('region', { name: 'Rendiconto' })
  await expect(summary).toContainText(/Entrate\s*100,00/)
  await expect(summary).toContainText(/Uscite\s*−20,00/)
  await expect(summary).toContainText(/Saldo\s*\+80,00\s€/)

  const rows = page.getByRole('region', { name: 'Uscite per categoria' }).getByRole('link')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText(/Spesa\s*12,40\s*62%/)
  await expect(rows.nth(1)).toContainText(/Ristoranti\s*7,60\s*38%/)

  await expect(page.getByRole('button', { name: 'Torna a oggi' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Periodo precedente' }).click()
  await page.getByRole('button', { name: 'Periodo precedente' }).click()
  await expect(page.getByText(/Nessun movimento a \S+\./)).toBeVisible()
  await expect(summary).toContainText(/Saldo\s*0,00\s€/)

  // «Oggi» comes back to the current month in one tap, then hides.
  await page.getByRole('button', { name: 'Torna a oggi' }).click()
  await expect(summary).toContainText(/Saldo\s*\+80,00\s€/)
  await expect(page.getByRole('button', { name: 'Torna a oggi' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Periodo precedente' }).click()

  await page.getByRole('tab', { name: 'Anno' }).click()
  await expect(page.getByRole('heading', { level: 2, name: /^\d{4}$/ })).toBeVisible()
})
