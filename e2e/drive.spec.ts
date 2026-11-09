import type { Browser, Page } from '@playwright/test'
import type { FakeDrive } from '../src/test/fake-drive'
import { Buffer } from 'node:buffer'
import { gunzipSync } from 'node:zlib'
import { fakeDropbox, fakeGoogle } from './drive'
import { expect, test } from './fixtures'

// The service worker would fetch for the page, out of reach of page.route.
test.use({ serviceWorkers: 'block' })

/** Adds an expense from the quick add, opened with the Home's button. */
async function addExpense(page: Page, keys: string[], category: string) {
  await page.getByRole('navigation').getByRole('link', { name: 'Home' }).click()
  await page.getByRole('link', { name: 'Uscita', exact: true }).click()
  const keypad = page.getByRole('group', { name: 'Tastierino' })
  for (const key of keys)
    await keypad.getByRole('button', { name: key, exact: true }).click()
  await page.getByRole('button', { name: category, exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Salvato' })).toBeVisible()
}

function driveRow(page: Page) {
  return page.getByRole('button', { name: /^Google Drive/ })
}

function driveSheet(page: Page) {
  return page.getByRole('dialog', { name: 'Google Drive' })
}

/** The transactions of each backup on the Drive. */
function backedUpTransactions(drive: FakeDrive): number[] {
  return drive.backups().map((file) => {
    const backup = JSON.parse(gunzipSync(file.bytes).toString('utf8')) as { data: { transactions: unknown[] } }
    return backup.data.transactions.length
  })
}

/** Connects Drive from the settings, as after «Collega» and Google's consent. */
async function connect(page: Page) {
  await page.getByRole('navigation').getByRole('link', { name: 'Impostazioni' }).click()
  await expect(driveRow(page)).toContainText('Collega il tuo account')
  await driveRow(page).click()
  await expect(page.getByRole('status').filter({ hasText: 'Google Drive collegato' })).toBeVisible()
}

/** A second phone on the same Google account: a fresh browser at the welcome page. */
async function secondDevice(browser: Browser, drive: FakeDrive, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL, serviceWorkers: 'block', locale: 'it-IT' })
  const page = await context.newPage()
  await fakeGoogle(page, drive)
  await page.goto('/')
  return page
}

test('connects Google Drive and backs up after a change', async ({ page }) => {
  const drive = await fakeGoogle(page)
  await page.reload()
  await connect(page)
  await expect(driveRow(page)).toContainText('Automatico')
  // The first backup goes a few seconds after the connection.
  await expect.poll(() => backedUpTransactions(drive), { timeout: 10_000 }).toEqual([0])
  await expect(driveRow(page)).toContainText('ultimo: ora')

  await addExpense(page, ['1', '2', 'Virgola', '4'], 'Spesa')
  await page.getByRole('navigation').getByRole('link', { name: 'Impostazioni' }).click()
  await driveRow(page).click()
  await expect(driveSheet(page)).toContainText('anna@example.com')
  await driveSheet(page).getByRole('button', { name: 'Esegui backup ora' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Backup su Google Drive fatto.' })).toBeVisible()
  // Still one file for today, now with the expense.
  expect(backedUpTransactions(drive)).toEqual([1])
})

test('restores the backup of another phone at the first start', async ({ page, browser, baseURL }) => {
  const drive = await fakeGoogle(page)
  await page.reload()
  await addExpense(page, ['7'], 'Ristoranti')
  await connect(page)
  await expect.poll(() => backedUpTransactions(drive), { timeout: 10_000 }).toEqual([1])

  const other = await secondDevice(browser, drive, baseURL)
  await expect(other.getByText('Il backup va sul tuo Google Drive')).toBeVisible()
  await other.getByRole('button', { name: 'Ripristina da Google Drive' }).click()
  const list = other.getByRole('dialog', { name: 'Backup su Google Drive' })
  await list.getByRole('button', { name: /1 movimento/ }).click()
  const confirm = other.getByRole('dialog', { name: 'Ripristinare questo backup?' })
  await expect(confirm).toContainText(/Movimenti\s*1/)
  await confirm.getByRole('button', { name: 'Ripristina' }).click()

  await expect(other.getByRole('tablist', { name: 'Periodo' })).toBeVisible()
  await other.getByRole('navigation').getByRole('link', { name: 'Movimenti' }).click()
  await expect(other.locator('main li').filter({
    has: other.getByRole('link'),
  })).toHaveCount(1)
  // Restored from Drive, the same data is not uploaded back.
  await other.getByRole('navigation').getByRole('link', { name: 'Impostazioni' }).click()
  await expect(driveRow(other)).toContainText('Automatico · ultimo:')
  await other.context().close()
})

test('encrypts the backups on Drive, and another phone restores them with the passphrase', async ({ page, browser, baseURL }) => {
  const drive = await fakeGoogle(page)
  await page.reload()
  await addExpense(page, ['7'], 'Ristoranti')
  await connect(page)
  await expect.poll(() => backedUpTransactions(drive), { timeout: 10_000 }).toEqual([1])

  await page.getByRole('button', { name: /^Cifratura dei backup/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Cifratura dei backup' })
  await sheet.getByLabel('Passphrase', { exact: true }).fill('nuvola di carta')
  await sheet.getByLabel('Ripeti la passphrase').fill('nuvola di carta')
  await sheet.getByRole('button', { name: 'Cifra i backup' }).click()
  // The file of today is replaced by an encrypted one.
  await expect.poll(() => drive.backups().map(file => file.name), { timeout: 10_000 }).toEqual([
    expect.stringMatching(/\.soldo$/),
  ])
  expect(Buffer.from(drive.backups()[0]!.bytes.subarray(0, 8)).toString('latin1')).toBe('SOLDOENC')

  const other = await secondDevice(browser, drive, baseURL)
  await other.getByRole('button', { name: 'Ripristina da Google Drive' }).click()
  const list = other.getByRole('dialog', { name: 'Backup su Google Drive' })
  await list.getByRole('button', { name: /1 movimento · cifrato/ }).click()
  const unlock = other.getByRole('dialog', { name: 'Backup cifrato' })
  await unlock.getByLabel('Passphrase').fill('nuvola di carta')
  await unlock.getByRole('button', { name: 'Apri' }).click()
  await other.getByRole('dialog', { name: 'Ripristinare questo backup?' }).getByRole('button', { name: 'Ripristina' }).click()
  await expect(other.getByRole('tablist', { name: 'Periodo' })).toBeVisible()

  // The second phone goes on encrypting with the same passphrase.
  await other.getByRole('navigation').getByRole('link', { name: 'Impostazioni' }).click()
  await expect(other.getByRole('button', { name: /^Cifratura dei backup/ })).toContainText('Attiva dal')
  await other.context().close()
})

test('asks before a fresh phone writes over the backups on Drive', async ({ page, browser, baseURL }) => {
  const drive = await fakeGoogle(page)
  await page.reload()
  await addExpense(page, ['7'], 'Ristoranti')
  await connect(page)
  await expect.poll(() => backedUpTransactions(drive), { timeout: 10_000 }).toEqual([1])

  const other = await secondDevice(browser, drive, baseURL)
  await other.getByRole('button', { name: 'Inizia da zero' }).click()
  await connect(other)
  await expect(driveRow(other)).toContainText('Scegli quali dati tenere', { timeout: 10_000 })
  expect(backedUpTransactions(drive)).toEqual([1])

  await driveRow(other).click()
  await expect(driveSheet(other)).toContainText('ci sono già backup di Soldo')
  await driveSheet(other).getByRole('button', { name: 'Tieni i dati di questo telefono' }).click()
  await expect(other.getByRole('status').filter({ hasText: 'Backup su Google Drive fatto.' })).toBeVisible()
  // One backup per day: today's file of the first phone went to the Drive trash.
  expect(backedUpTransactions(drive)).toEqual([0])
  await other.context().close()
})

test('backs up to Dropbox, and another phone restores from it at the first start', async ({ page, browser, baseURL }) => {
  const cloud = await fakeDropbox(page)
  await page.reload()
  await addExpense(page, ['9'], 'Ristoranti')
  await page.getByRole('navigation').getByRole('link', { name: 'Impostazioni' }).click()
  const row = page.getByRole('button', { name: /^Dropbox/ })
  await expect(row).toContainText('Collega il tuo account')
  // Only the services configured on the site: here Dropbox.
  await expect(driveRow(page)).toHaveCount(0)
  await row.click()
  await expect(page.getByRole('status').filter({ hasText: 'Dropbox collegato' })).toBeVisible()
  await expect.poll(() => cloud.backups(), { timeout: 10_000 }).toEqual([
    expect.stringMatching(/^soldo-backup-.*\.json\.gz$/),
  ])
  await expect(row).toContainText('ultimo: ora')
  await row.click()
  const sheet = page.getByRole('dialog', { name: 'Dropbox' })
  await expect(sheet).toContainText('Applicazioni/Soldo')
  await expect(sheet).toContainText('anna@example.com')

  const context = await browser.newContext({ baseURL, serviceWorkers: 'block', locale: 'it-IT' })
  const other = await context.newPage()
  await fakeDropbox(other, cloud)
  await other.goto('/')
  await expect(other.getByText('Il backup va sul tuo Dropbox')).toBeVisible()
  await other.getByRole('button', { name: 'Ripristina da Dropbox' }).click()
  const list = other.getByRole('dialog', { name: 'Backup su Dropbox' })
  await list.getByRole('button', { name: /1 movimento/ }).click()
  await other.getByRole('dialog', { name: 'Ripristinare questo backup?' }).getByRole('button', { name: 'Ripristina' }).click()
  await expect(other.getByRole('tablist', { name: 'Periodo' })).toBeVisible()
  await other.getByRole('navigation').getByRole('link', { name: 'Impostazioni' }).click()
  await expect(other.getByRole('button', { name: /^Dropbox/ })).toContainText('Automatico · ultimo:')
  await context.close()
})
