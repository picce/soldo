import type { Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

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
    expect(content).toMatchObject({ app: 'soldo', format: 1 })
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
    expect(lines[0]).toBe('Data;Tipo;Importo;Categoria;Conto;Nota')
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2};Uscita;-12,40;Spesa;Contanti;$/)
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
