import { expect, test } from '@playwright/test'

test('the first start leads to the welcome, and «Inizia da zero» opens the Home', async ({ page }) => {
  // Any page leads to the welcome until the first start is done.
  await page.goto('/movimenti')
  await expect(page).toHaveURL(/\/benvenuto$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Soldo' })).toBeVisible()
  await expect(page.getByText('Il quaderno dei conti di casa.')).toBeVisible()
  await expect(page.getByText('Il backup è un file tuo')).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)

  await page.getByRole('button', { name: 'Inizia da zero' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText(/Nessun movimento a \S+\./)).toBeVisible()

  // The default categories are there.
  await page.goto('/impostazioni')
  await expect(page.getByText('12 uscite · 4 entrate')).toBeVisible()

  // Next time the app opens straight on the Home, and the welcome is not reachable.
  await page.goto('/benvenuto')
  await expect(page).toHaveURL(/\/$/)
  await page.reload()
  await expect(page.getByRole('tablist', { name: 'Periodo' })).toBeVisible()
})

test('a backup restored from the welcome opens the Home with its data', async ({ page, browser, baseURL }) => {
  // A backup made on «another device» (a desktop browser: the file is downloaded).
  const otherContext = await browser.newContext({ baseURL, locale: 'it-IT' })
  const other = await otherContext.newPage()
  await other.goto('/')
  await other.getByRole('button', { name: 'Inizia da zero' }).click()
  await other.goto('/nuovo/uscita')
  await other.getByRole('group', { name: 'Tastierino' }).getByRole('button', { name: '8', exact: true }).click()
  await other.getByRole('button', { name: 'Ristoranti', exact: true }).click()
  await expect(other.getByRole('status').filter({ hasText: 'Salvato' })).toBeVisible()
  await other.goto('/impostazioni')
  const downloading = other.waitForEvent('download')
  await other.getByRole('button', { name: /^Esporta backup/ }).click()
  const backup = await (await downloading).path()

  await page.goto('/')
  await expect(page).toHaveURL(/\/benvenuto$/)
  await page.locator('input[type="file"]').setInputFiles(backup)
  await page.getByRole('dialog', { name: 'Ripristinare questo backup?' }).getByRole('button', { name: 'Ripristina' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('status').filter({ hasText: 'Backup ripristinato.' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Uscite per categoria' })).toContainText('Ristoranti')
  await otherContext.close()
})

test.describe('on iPhone', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' })

  test('explains how to install and why', async ({ page }) => {
    await page.goto('/')
    const card = page.getByRole('region', { name: 'Installa Soldo' })
    await expect(card).toContainText('Su iPhone tocca Condividi')
    await expect(card.getByRole('button')).toHaveCount(0)
  })
})
