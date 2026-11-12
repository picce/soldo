import type { Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { expect, test } from './fixtures'

/** Adds an expense from the quick add. */
async function addExpense(page: Page, keys: string[], category: string) {
  await page.goto('/nuovo/uscita')
  const keypad = page.getByRole('group', { name: 'Tastierino' })
  for (const key of keys)
    await keypad.getByRole('button', { name: key, exact: true }).click()
  await page.getByRole('button', { name: category, exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Salvato' })).toBeVisible()
}

/** Clicks a settings row and returns the file that the browser downloads. */
async function download(page: Page, row: string) {
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', {
    name: new RegExp(`^${row}`),
  }).click()
  const file = await downloading
  return {
    name: file.suggestedFilename(),
    path: (await file.path())!,
  }
}

function transactionRows(page: Page) {
  return page.locator('main li').filter({
    has: page.getByRole('link'),
  })
}

test.describe('without the share sheet', () => {
  // Desktop-like: no Web Share, so files are downloaded.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { value: undefined })
    })
  })

  test('exports a backup and restores it after a confirmation', async ({ page }) => {
    await addExpense(page, ['1', '2', 'Virgola', '4'], 'Spesa')

    await page.goto('/impostazioni')
    await expect(page.getByText('ultimo: mai')).toBeVisible()
    const backup = await download(page, 'Esporta backup')
    expect(backup.name).toMatch(/^soldo-backup-\d{4}-\d{2}-\d{2}\.json$/)
    const content = JSON.parse(await readFile(backup.path, 'utf8'))
    expect(content).toMatchObject({ app: 'soldo', format: 4 })
    expect(content.data.transactions).toHaveLength(1)
    await expect(page.getByRole('status').filter({ hasText: 'Backup esportato.' })).toBeVisible()
    await expect(page.getByText('ultimo: ora')).toBeVisible()

    // A second expense after the backup: restoring removes it.
    await addExpense(page, ['5'], 'Casa')
    await page.goto('/impostazioni')
    await page.locator('input[type="file"]').setInputFiles(backup.path)
    const dialog = page.getByRole('dialog', { name: 'Ripristinare questo backup?' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(/Movimenti\s*1/)
    await expect(dialog).toContainText('I dati attuali di questo telefono verranno sostituiti.')
    await dialog.getByRole('button', { name: 'Ripristina' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Backup ripristinato.' })).toBeVisible()

    await page.goto('/movimenti')
    await expect(transactionRows(page)).toHaveCount(1)
    await expect(transactionRows(page).first()).toContainText('Spesa')
  })

  test('encrypts the backup with a passphrase and asks it to restore', async ({ page }) => {
    await addExpense(page, ['8'], 'Spesa')
    await page.goto('/impostazioni')
    const row = page.getByRole('button', { name: /^Cifratura dei backup/ })
    await expect(row).toContainText('Disattivata')
    await row.click()
    const sheet = page.getByRole('dialog', { name: 'Cifratura dei backup' })
    await expect(sheet).toContainText('Nessuno può recuperarla')
    await sheet.getByLabel('Passphrase', { exact: true }).fill('corto')
    await sheet.getByLabel('Ripeti la passphrase').fill('corto')
    await sheet.getByRole('button', { name: 'Cifra i backup' }).click()
    await expect(sheet).toContainText('Almeno 8 caratteri.')
    await sheet.getByLabel('Passphrase', { exact: true }).fill('nuvola di carta')
    await sheet.getByLabel('Ripeti la passphrase').fill('nuvola di cartaa')
    await sheet.getByRole('button', { name: 'Cifra i backup' }).click()
    await expect(sheet).toContainText('Le due passphrase non coincidono.')
    await sheet.getByLabel('Ripeti la passphrase').fill('nuvola di carta')
    await sheet.getByRole('button', { name: 'Cifra i backup' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Da ora i backup sono cifrati.' })).toBeVisible()
    await expect(row).toContainText('Attiva dal')

    const backup = await download(page, 'Esporta backup')
    expect(backup.name).toMatch(/^soldo-backup-\d{4}-\d{2}-\d{2}\.soldo$/)
    const bytes = await readFile(backup.path)
    expect(bytes.subarray(0, 8).toString('latin1')).toBe('SOLDOENC')
    expect(bytes.toString('latin1')).not.toContain('Spesa')

    // A second expense after the backup: restoring removes it, once the passphrase is right.
    await addExpense(page, ['5'], 'Casa')
    await page.goto('/impostazioni')
    await page.locator('input[type="file"]').setInputFiles(backup.path)
    const unlock = page.getByRole('dialog', { name: 'Backup cifrato' })
    await unlock.getByLabel('Passphrase').fill('nuvola di cartone')
    await unlock.getByRole('button', { name: 'Apri' }).click()
    await expect(unlock).toContainText('Passphrase sbagliata.')
    await unlock.getByLabel('Passphrase').fill('nuvola di carta')
    await unlock.getByRole('button', { name: 'Apri' }).click()
    const dialog = page.getByRole('dialog', { name: 'Ripristinare questo backup?' })
    await expect(dialog).toContainText(/Movimenti\s*1/)
    await dialog.getByRole('button', { name: 'Ripristina' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Backup ripristinato.' })).toBeVisible()
    await page.goto('/movimenti')
    await expect(transactionRows(page)).toHaveCount(1)

    // Turned off, the next export is plain JSON again.
    await page.goto('/impostazioni')
    await row.click()
    await sheet.getByRole('button', { name: 'Disattiva la cifratura' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Da ora i backup non sono cifrati.' })).toBeVisible()
    await expect(row).toContainText('Disattivata')
    expect((await download(page, 'Esporta backup')).name).toMatch(/\.json$/)
  })

  test('refuses a file that is not a backup, touching nothing', async ({ page }) => {
    await addExpense(page, ['7'], 'Spesa')
    await page.goto('/impostazioni')
    await page.locator('input[type="file"]').setInputFiles({
      name: 'appunti.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"hello": "world"}'),
    })
    await expect(page.getByRole('status').filter({ hasText: 'Questo file non è un backup di Soldo.' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.goto('/movimenti')
    await expect(transactionRows(page)).toHaveCount(1)
  })

  test('exports the transactions as CSV for a spreadsheet', async ({ page }) => {
    await addExpense(page, ['1', '2', 'Virgola', '4'], 'Spesa')
    await page.goto('/impostazioni')
    const csv = await download(page, 'Esporta movimenti')
    expect(csv.name).toMatch(/^soldo-movimenti-\d{4}-\d{2}-\d{2}\.csv$/)
    const text = await readFile(csv.path, 'utf8')
    const lines = text.replace(/^\uFEFF/, '').split('\r\n')
    expect(text.charCodeAt(0)).toBe(0xFEFF)
    expect(lines[0]).toBe('Data;Tipo;Importo;Categoria;Conto;Pagamento;Nota')
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2};Uscita;-12,40;Spesa;Contanti;Contanti;$/)
    // The CSV is not a backup: the last backup stays «mai».
    await expect(page.getByText('ultimo: mai')).toBeVisible()
  })
})

test('on a phone the backup goes to the share sheet', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', {
      value: () => true,
    })
    Object.defineProperty(navigator, 'share', {
      value: async (data: ShareData) => {
        document.documentElement.dataset.shared = data.files?.[0]?.name
      },
    })
  })
  await page.goto('/impostazioni')
  await page.getByRole('button', { name: /^Esporta backup/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Backup esportato.' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-shared', /^soldo-backup-.+\.json$/)
})
