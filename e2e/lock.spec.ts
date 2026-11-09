import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'

/** Types a PIN on the PIN keypad inside `scope`. */
async function typePin(scope: Locator, pin: string) {
  const pad = scope.getByRole('group', { name: 'Tastierino del PIN' })
  for (const digit of pin)
    await pad.getByRole('button', { name: digit, exact: true }).click()
}

function lockScreen(page: Page) {
  return page.getByRole('dialog', { name: 'Scrivi il PIN' })
}

/** Turns the lock on from the settings with the PIN 2468, after a wrong repeat. */
async function enableLock(page: Page) {
  await page.goto('/impostazioni')
  const row = page.getByRole('button', { name: /^Blocco con PIN/ })
  await expect(row).toContainText('Disattivato')
  await row.click()
  const sheet = page.getByRole('dialog', { name: 'Blocco con PIN' })
  await sheet.getByRole('button', { name: 'Scegli un PIN' }).click()
  await expect(sheet).toContainText('Scegli un PIN di 4 cifre')
  await typePin(sheet, '2468')
  await expect(sheet).toContainText('Scrivilo di nuovo')
  await typePin(sheet, '2469')
  await expect(sheet).toContainText('I due PIN non coincidono.')
  await typePin(sheet, '2468')
  await typePin(sheet, '2468')
  await expect(page.getByRole('status').filter({ hasText: 'Blocco attivato.' })).toBeVisible()
  await expect(row).toContainText('Attivo · subito')
}

test('asks the PIN when the app opens, and opens only with the right one', async ({ page }) => {
  await enableLock(page)
  await page.reload()
  await expect(lockScreen(page)).toBeVisible()
  // The app behind cannot be reached: it is inert.
  await expect(page.locator('.app-shell')).toHaveAttribute('inert')

  await typePin(lockScreen(page), '1357')
  await expect(lockScreen(page)).toContainText('PIN sbagliato.')
  // A keyboard types it too.
  await page.keyboard.type('2468')
  await expect(lockScreen(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Impostazioni' })).toBeVisible()

  // Turned off, the next start opens at once.
  await page.getByRole('button', { name: /^Blocco con PIN/ }).click()
  await page.getByRole('dialog', { name: 'Blocco con PIN' }).getByRole('button', { name: 'Disattiva il blocco' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Blocco disattivato.' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Impostazioni' })).toBeVisible()
  await expect(lockScreen(page)).toHaveCount(0)
})

test('a forgotten PIN can only erase the data of this phone, after asking twice', async ({ page }) => {
  await enableLock(page)
  await page.reload()
  await lockScreen(page).getByRole('button', { name: 'Hai dimenticato il PIN?' }).click()
  await expect(lockScreen(page)).toContainText('Puoi solo cancellare i dati di questo telefono')
  await lockScreen(page).getByRole('button', { name: 'Cancella i dati' }).click()
  await lockScreen(page).getByRole('button', { name: 'Sì, cancella tutto' }).click()
  await expect(page.getByRole('button', { name: 'Inizia da zero' })).toBeVisible()
  await expect(lockScreen(page)).toHaveCount(0)
})
