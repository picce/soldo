import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

/** Moves the clock of the page: the next load sees that day. */
async function setDay(page: Page, day: string) {
  await page.clock.setFixedTime(new Date(`${day}T10:00:00`))
}

test.beforeEach(async ({ page }) => {
  await setDay(page, '2026-11-07')
})

async function typeAmount(page: Page, keys: string[]) {
  const keypad = page.getByRole('group', { name: 'Tastierino' })
  for (const key of keys)
    await keypad.getByRole('button', { name: key, exact: true }).click()
}

/** Rent of 750 € every month from today, from «Nuova ricorrenza». */
async function addRent(page: Page) {
  await page.goto('/impostazioni/ricorrenze')
  await page.getByRole('link', { name: 'Nuova ricorrenza' }).click()
  await expect(page.getByRole('button', { name: 'Data: Oggi · mensile' })).toBeVisible()
  await typeAmount(page, ['7', '5', '0'])
  await page.getByRole('button', { name: 'Casa', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Salvato: −750,00 € · Casa. Si ripete ogni mese.')
}

function rows(page: Page) {
  return page.locator('main li').filter({
    has: page.getByRole('link', { name: /Ricorrente/ }),
  })
}

async function openSeries(page: Page) {
  await page.goto('/impostazioni/ricorrenze')
  await page.getByRole('region', { name: 'Attive' }).getByRole('link', { name: /^Casa/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Modifica ricorrenza' })).toBeAttached()
}

test('a monthly rent is there at once, and comes back by itself once a month', async ({ page }) => {
  await addRent(page)
  await page.goto('/movimenti')
  await expect(rows(page)).toHaveCount(1)

  await setDay(page, '2026-12-07')
  await page.goto('/movimenti')
  await expect(page.getByRole('status')).toHaveText('Aggiunto dalle ricorrenze: Casa')
  await expect(rows(page)).toHaveCount(2)
  await expect(rows(page).first()).toContainText('−750,00')

  // Opening again adds nothing twice.
  await page.reload()
  await expect(rows(page)).toHaveCount(2)
  await page.goto('/impostazioni')
  await expect(page.getByRole('link', { name: /Movimenti ricorrenti/ })).toContainText('1 attiva')
})

test('a transaction of the series leads to it, and deleting it does not bring it back', async ({ page }) => {
  await addRent(page)
  await page.goto('/movimenti')
  await rows(page).getByRole('link').click()
  await expect(page.getByText('Ogni mese')).toBeVisible()
  await page.getByRole('link', { name: 'Modifica la serie' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Modifica ricorrenza' })).toBeAttached()

  await page.goto('/movimenti')
  await rows(page).getByRole('link').click()
  await page.getByRole('button', { name: 'Elimina movimento' }).click()
  await expect(page.getByRole('status')).toContainText('Eliminato')
  await page.reload()
  await expect(page.getByText('Nessun movimento')).toBeVisible()
  await expect(rows(page)).toHaveCount(0)
})

test('a stopped series adds nothing more, and is among those that are over', async ({ page }) => {
  await addRent(page)
  await openSeries(page)
  await page.getByRole('button', { name: 'Interrompi' }).click()
  await expect(page.getByRole('status')).toContainText('Interrotta: Casa')

  await setDay(page, '2027-01-07')
  await page.goto('/movimenti')
  await expect(rows(page)).toHaveCount(1)
  await page.goto('/impostazioni/ricorrenze')
  await expect(page.getByText('Concluse (1)')).toBeVisible()
})

test('a new amount changes the next transactions only', async ({ page }) => {
  await addRent(page)
  await openSeries(page)
  await typeAmount(page, [
    'Cancella',
    'Cancella',
    'Cancella',
    'Cancella',
    'Cancella',
    'Cancella',
    '8',
    '0',
    '0',
  ])
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('status')).toHaveText('Salvato: −800,00 € · Casa')

  await setDay(page, '2026-12-07')
  await page.goto('/movimenti')
  await expect(rows(page)).toHaveCount(2)
  await expect(rows(page).nth(0)).toContainText('−800,00')
  await expect(rows(page).nth(1)).toContainText('−750,00')
})
