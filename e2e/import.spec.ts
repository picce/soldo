import type { Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { expect, pageSettled, test } from './fixtures'

/**
 * Import of a bank statement (docs/specs/released/import-da-file.md): an invented CSV with Dare and
 * Avere, a preamble and a balance at the end.
 */
const STATEMENT = [
  'Estratto conto;Conto 1000/12345',
  'Periodo;01/03/2026 - 31/03/2026',
  '',
  'Data contabile;Data valuta;Dare;Avere;Descrizione;Causale',
  '02/03/2026;02/03/2026;45,90;;PAGAMENTO POS ESSELUNGA MILANO;Pagamento POS',
  '05/03/2026;05/03/2026;;1.850,00;BONIFICO DA ACME SRL;Bonifico',
  '07/03/2026;06/03/2026;1,20;;PAGAMENTO POS BAR SPORT;Pagamento POS',
  '09/03/2026;08/03/2026;2,40;;PAGAMENTO POS BAR SPORT;Pagamento POS',
  'Saldo contabile al 31/03/2026;;;1.800,50;;',
].join('\r\n')

async function openImport(page: Page) {
  await page.getByRole('navigation', { name: 'Navigazione principale' }).getByRole('link', { name: 'Impostazioni' }).click()
  await page.getByRole('link', { name: /Importa estratto conto/ }).click()
  await expect(page.getByRole('heading', { name: 'Dall\'home banking a Soldo' })).toBeVisible()
}

async function chooseFile(page: Page) {
  await page.locator('input[type="file"]').setInputFiles({
    name: 'marzo.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(STATEMENT, 'utf8'),
  })
  await expect(page.getByRole('heading', { name: 'In quale conto vanno?' })).toBeVisible()
  await page.getByRole('button', { name: 'Contanti' }).click()
}

test('a statement comes in once, with the categories chosen in the preview', async ({ page }) => {
  await openImport(page)
  await chooseFile(page)

  // The columns are proposed from their names.
  await expect(page.getByRole('heading', { name: 'Che cosa c\'è nelle colonne' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Data\s+Data contabile/ })).toBeVisible()
  await expect(page.getByText('4 movimenti letti')).toBeVisible()
  await page.getByRole('button', { name: 'Continua' }).click()

  await expect(page.getByText('4 movimenti nuovi')).toBeVisible()
  const list = page.getByRole('region', { name: 'Movimenti del file' })
  await pageSettled(page)
  await list.getByRole('button', { name: /BAR SPORT/ }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Movimento del file' })
  await sheet.getByRole('button', { name: 'Ristoranti' }).click()
  await expect(sheet.getByRole('checkbox', { name: 'Ricorda per le descrizioni che contengono' })).toBeChecked()
  await expect(sheet.getByRole('textbox', { name: 'Parola chiave' })).toHaveValue('BAR SPORT')
  await sheet.getByRole('button', { name: 'Fatto' }).click()
  // The rule changes the other coffee too.
  await expect(list.getByRole('button', { name: /BAR SPORT.*Ristoranti/ })).toHaveCount(2)

  await page.getByRole('button', { name: 'Importa 4 movimenti' }).click()
  await expect(page).toHaveURL(/\/movimenti$/)
  await expect(page.getByRole('status').filter({ hasText: 'Importati 4 movimenti' })).toBeVisible()
  await expect(page.getByRole('link', { name: /PAGAMENTO POS ESSELUNGA MILANO/ })).toBeVisible()

  // The same file again: the columns are known, nothing is new.
  await openImport(page)
  await chooseFile(page)
  await expect(page.getByText(/4 già importati/)).toBeVisible()
  await expect(page.getByText('Niente di nuovo: i movimenti di questo file sono già in Soldo.')).toBeVisible()

  // The rule is in its page.
  await page.goto('/impostazioni/regole')
  await expect(page.getByRole('button', { name: /«BAR SPORT».*Ristoranti/ })).toBeVisible()
})

test('«Annulla» takes the import back', async ({ page }) => {
  await openImport(page)
  await chooseFile(page)
  await page.getByRole('button', { name: 'Continua' }).click()
  await page.getByRole('button', { name: 'Importa 4 movimenti' }).click()
  await expect(page).toHaveURL(/\/movimenti$/)
  await page.getByRole('status').getByRole('button', { name: 'Annulla' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Import annullato' })).toBeVisible()
  await expect(page.getByRole('link', { name: /PAGAMENTO POS ESSELUNGA MILANO/ })).toHaveCount(0)
})

test('a file that is not a statement says so', async ({ page }) => {
  await openImport(page)
  await page.locator('input[type="file"]').setInputFiles({
    name: 'estratto.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7 ...'),
  })
  await expect(page.getByRole('alert')).toHaveText(/Salva l'estratto conto in CSV o in Excel/)
})

test('a statement shared from another app opens the import with the file chosen', async ({ page }) => {
  // The service worker takes the share: it must control the page first.
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  // What the share sheet of Android does: a POST of the file to the share target.
  await page.evaluate((text) => {
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = '/api/share-target'
    form.enctype = 'multipart/form-data'
    const input = document.createElement('input')
    input.type = 'file'
    input.name = 'statement'
    const files = new DataTransfer()
    files.items.add(new File([text], 'marzo.csv', { type: 'text/csv' }))
    input.files = files.files
    form.append(input)
    document.body.append(form)
    form.submit()
  }, STATEMENT)

  await expect(page).toHaveURL(/\/impostazioni\/importa\?/)
  await expect(page.getByRole('heading', { name: 'In quale conto vanno?' })).toBeVisible()
  await expect(page.getByText(/marzo\.csv/)).toBeVisible()
})
