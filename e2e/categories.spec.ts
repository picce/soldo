import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

function categoryGrid(page: Page) {
  return page.getByRole('region', { name: 'Categoria' })
}

async function openCategories(page: Page) {
  await page.goto('/impostazioni')
  await page.getByRole('link', { name: /Uscite ed entrate/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Categorie' })).toBeVisible()
}

test('a new category shows up in the quick-add grid', async ({ page }) => {
  await openCategories(page)
  await page.getByRole('link', { name: 'Nuova categoria' }).click()
  await page.getByRole('textbox', { name: 'Nome' }).fill('Palestra')
  await page.getByRole('radio', { name: 'Bilanciere' }).check()
  await page.getByRole('radio', { name: 'Verde', exact: true }).check()
  await page.getByRole('button', { name: 'Salva' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Categorie' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Categorie di uscita' }).getByRole('link').last()).toHaveText('Palestra')

  await page.goto('/nuovo/uscita')
  await expect(categoryGrid(page).getByRole('button', { name: 'Palestra' })).toBeVisible()
})

test('an archived category leaves the grid and stays in the transactions', async ({ page }) => {
  // A transaction in Animali, then Animali archived.
  await page.goto('/nuovo/uscita')
  await page.getByRole('group', { name: 'Tastierino' }).getByRole('button', { name: '9', exact: true }).click()
  await page.getByRole('button', { name: 'Animali', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Salvato' })).toBeVisible()

  await openCategories(page)
  await page.getByRole('link', { name: 'Animali' }).click()
  await expect(page.getByText('Usata in 1 movimento')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Elimina categoria' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Archivia' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Archiviata: Animali' })).toBeVisible()
  await expect(page.getByText('Archiviate (1)')).toBeVisible()

  await page.goto('/nuovo/uscita')
  await expect(categoryGrid(page).getByRole('button', { name: 'Viaggi' })).toBeVisible()
  await expect(categoryGrid(page).getByRole('button', { name: 'Animali' })).toHaveCount(0)

  await page.goto('/movimenti')
  await expect(page.locator('main li').filter({ hasText: 'Animali' })).toHaveCount(1)
})

test('rows move with the keyboard buttons and with the handle', async ({ page }) => {
  await openCategories(page)
  const list = page.getByRole('list', { name: 'Categorie di uscita' })
  await list.getByRole('button', { name: 'Sposta giù: Spesa' }).focus()
  await expect(list.getByRole('button', { name: 'Sposta giù: Spesa' })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(list.getByRole('link').nth(1)).toHaveText('Spesa')

  // Dragging Ristoranti by its handle to the top.
  const handle = list.locator('li').nth(2).locator('.category-row__handle')
  const box = (await handle.boundingBox())!
  const top = (await list.locator('li').first().boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, top.y + 4, { steps: 10 })
  await page.mouse.up()
  await expect(list.getByRole('link').first()).toHaveText('Ristoranti')

  // The quick add follows the new order.
  await page.goto('/nuovo/uscita')
  const grid = categoryGrid(page).getByRole('button')
  await expect(grid.nth(0)).toHaveText('Ristoranti')
  await expect(grid.nth(1)).toHaveText('Casa')
  await expect(grid.nth(2)).toHaveText('Spesa')
})
