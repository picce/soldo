import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

/** Adds a transaction from the quick add, with an optional note. */
async function add(page: Page, kind: 'uscita' | 'entrata', keys: string[], category: string, note = '') {
  await page.goto(`/nuovo/${kind}`)
  const keypad = page.getByRole('group', { name: 'Tastierino' })
  for (const key of keys)
    await keypad.getByRole('button', { name: key, exact: true }).click()
  if (note) {
    await page.getByRole('button', { name: 'Nota', exact: true }).click()
    await page.getByRole('textbox', { name: 'Nota' }).fill(note)
  }
  await page.getByRole('button', { name: category, exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Salvato' })).toBeVisible()
}

/** Drags a row sideways with the mouse, which sends the same pointer events as a finger. */
async function swipe(page: Page, row: ReturnType<Page['locator']>, direction: 'left' | 'right') {
  const box = (await row.boundingBox())!
  const y = box.y + box.height / 2
  const startX = direction === 'left'
    ? box.x + box.width - 10
    : box.x + 10
  const endX = direction === 'left'
    ? box.x + 20
    : box.x + box.width - 20
  await page.mouse.move(startX, y)
  await page.mouse.down()
  await page.mouse.move(endX, y, { steps: 12 })
  await page.mouse.up()
}

function rows(page: Page) {
  return page.locator('main li').filter({
    has: page.getByRole('link'),
  })
}

test.beforeEach(async ({ page }) => {
  await add(page, 'uscita', ['1', '2', 'Virgola', '4'], 'Spesa', 'Esselunga')
  await add(page, 'uscita', ['1', 'Virgola', '8'], 'Ristoranti', 'Caffè')
  await add(page, 'entrata', ['5', '0'], 'Rimborsi')
  await page.goto('/movimenti')
  await expect(rows(page)).toHaveCount(3)
})

test('searches notes and categories, ignoring case and accents', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Cerca nelle note e nelle categorie' }).fill('esselunga')
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('Esselunga')
  await expect(page).toHaveURL(/q=esselunga/)

  await page.getByRole('searchbox').fill('caffe')
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('Caffè')

  await page.getByRole('searchbox').fill('pizza')
  await expect(page.getByText('Nessun risultato per «pizza».')).toBeVisible()

  // The search stays after a reload.
  await page.reload()
  await expect(page.getByRole('searchbox')).toHaveValue('pizza')
})

test('filters by kind and category', async ({ page }) => {
  await page.getByRole('button', { name: 'Entrate', exact: true }).click()
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('Rimborsi')

  await page.getByRole('button', { name: 'Tutti', exact: true }).click()
  await page.getByRole('button', { name: 'Categoria', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Ristoranti' }).check()
  await page.getByRole('button', { name: 'Applica (1)' }).click()
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('Caffè')
  await expect(page.getByRole('button', { name: 'Categoria (1)' })).toHaveAttribute('aria-pressed', 'true')
})

test('opens the list filtered from a category of the Home', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('region', { name: 'Uscite per categoria' }).getByRole('link', { name: /Spesa/ }).click()
  await expect(page).toHaveURL(/\/movimenti\?categoria=/)
  await expect(rows(page)).toHaveCount(1)
  await expect(page.getByRole('button', { name: /^Togli il filtro/ })).toBeVisible()
})

test('deletes a row swiped to the left, and Annulla brings it back', async ({ page }) => {
  await swipe(page, rows(page).filter({ hasText: 'Esselunga' }), 'left')
  await expect(page.getByRole('status').filter({ hasText: /Eliminato: −12,40\s€ · Spesa/ })).toBeVisible()
  await expect(rows(page)).toHaveCount(2)

  await page.getByRole('button', { name: 'Annulla' }).click()
  await expect(rows(page)).toHaveCount(3)
})

test('duplicates a row swiped to the right, and Annulla removes the copy', async ({ page }) => {
  await swipe(page, rows(page).filter({ hasText: 'Caffè' }), 'right')
  await expect(page.getByRole('status').filter({ hasText: /Duplicato: −1,80\s€ · Ristoranti/ })).toBeVisible()
  await expect(rows(page).filter({ hasText: 'Caffè' })).toHaveCount(2)
  // The swipe did not open the edit screen.
  await expect(page).toHaveURL(/\/movimenti$/)

  await page.getByRole('button', { name: 'Annulla' }).click()
  await expect(rows(page).filter({ hasText: 'Caffè' })).toHaveCount(1)
})

test('a short swipe changes nothing, a tap opens the edit screen', async ({ page }) => {
  const row = rows(page).filter({ hasText: 'Esselunga' })
  const box = (await row.boundingBox())!
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 60, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
  await expect(rows(page)).toHaveCount(3)
  await expect(page).toHaveURL(/\/movimenti$/)

  await row.getByRole('link').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Modifica movimento' })).toBeAttached()
})
