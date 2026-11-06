import type { Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { test as baseTest } from '@playwright/test'
import { expect, test } from './fixtures'

async function typeAmount(page: Page, keys: string[]) {
  const keypad = page.getByRole('group', { name: 'Tastierino' })
  for (const key of keys)
    await keypad.getByRole('button', { name: key, exact: true }).click()
}

async function createAccount(page: Page, name: string, balance = '') {
  await page.goto('/impostazioni/conti')
  await page.getByRole('link', { name: 'Nuovo conto' }).click()
  await page.getByRole('textbox', { name: 'Nome' }).fill(name)
  await page.getByRole('textbox', { name: 'Saldo iniziale' }).fill(balance)
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('list', { name: 'Conti' }).getByRole('link', {
    name: new RegExp(name),
  })).toBeVisible()
}

/** Charges a payment method to another account, from its page. */
async function linkPayment(page: Page, payment: string, account: string) {
  await page.goto('/impostazioni/pagamenti')
  await page.getByRole('list', { name: 'Tipi di pagamento' }).getByRole('link', {
    name: new RegExp(`^${payment}`),
  }).click()
  await page.getByRole('region', { name: 'Conto collegato' }).getByRole('button').click()
  await page.getByRole('dialog').getByRole('button', {
    name: new RegExp(account),
  }).click()
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('list', { name: 'Tipi di pagamento' }).getByRole('link', {
    name: new RegExp(`^${payment}.*${account}`),
  })).toBeVisible()
}

/** An expense from the quick add; `payment` opens the sheet and picks it. */
async function addExpense(page: Page, keys: string[], category: string, payment?: string) {
  await page.goto('/nuovo/uscita')
  if (payment) {
    await page.getByRole('button', { name: /^Pagamento: / }).click()
    await page.getByRole('dialog').getByRole('button', {
      name: new RegExp(`^${payment}`),
    }).click()
    await expect(page.getByRole('button', { name: `Pagamento: ${payment}` })).toBeVisible()
  }
  await typeAmount(page, keys)
  await page.getByRole('button', { name: category, exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Salvato' })).toBeVisible()
}

async function addTransfer(page: Page, keys: string[]) {
  await page.goto('/nuovo/trasferimento')
  await expect(page.getByRole('heading', { level: 1, name: 'Nuovo trasferimento' })).toBeAttached()
  await typeAmount(page, keys)
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Salvato' })).toBeVisible()
}

function accountRow(page: Page, name: string) {
  return page.getByRole('list', { name: 'Conti' }).getByRole('link', {
    name: new RegExp(name),
  })
}

test('with one account an expense takes the same taps, and nothing else appears', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^Conto:/ })).toHaveCount(0)

  await page.goto('/nuovo/uscita')
  await expect(page.getByRole('button', { name: 'Pagamento: Contanti' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Trasferimento' })).toHaveCount(0)
  await typeAmount(page, ['5'])
  await page.getByRole('button', { name: 'Spesa', exact: true }).click()

  await expect(page.getByRole('status').filter({ hasText: /Salvato: −5,00\s€ · Spesa/ })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
})

test('the next expense starts from the payment method last used', async ({ page }) => {
  await addExpense(page, ['5'], 'Spesa', 'Carta')
  await page.goto('/nuovo/uscita')
  await expect(page.getByRole('button', { name: 'Pagamento: Carta' })).toBeVisible()

  await page.goto('/movimenti')
  await expect(page.getByRole('link', { name: /Spesa/ })).toContainText('Carta')
})

test('a payment method tied to another account changes that balance', async ({ page }) => {
  await createAccount(page, 'Banca', '1.000,00')
  await linkPayment(page, 'Carta', 'Banca')
  await addExpense(page, ['2', '5'], 'Spesa', 'Carta')

  await page.goto('/impostazioni/conti')
  await expect(accountRow(page, 'Banca')).toContainText('975,00')
  await expect(accountRow(page, 'Contanti')).toContainText('0,00')
})

test('a transfer changes the two balances and not the statement', async ({ page }) => {
  await createAccount(page, 'Banca', '1.000,00')
  await addTransfer(page, ['1', '0', '0'])

  await page.goto('/impostazioni/conti')
  await expect(accountRow(page, 'Contanti')).toContainText('−100,00')
  await expect(accountRow(page, 'Banca')).toContainText('1.100,00')
  await expect(page.getByText('Totale').locator('..')).toContainText('1.000,00')

  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Rendiconto' })).toContainText(/Saldo\s*0,00/)

  await page.goto('/movimenti')
  const row = page.getByRole('link', { name: /Trasferimento/ })
  await expect(row).toContainText('Contanti → Banca')
  await expect(row).toContainText('100,00')
})

test('a transfer opens in its own editor, and duplicates', async ({ page }) => {
  await createAccount(page, 'Banca')
  await addTransfer(page, ['1', '0'])
  await page.goto('/movimenti')
  const row = page.getByRole('link', { name: /Trasferimento/ })
  await row.click()
  await expect(page.getByRole('button', { name: 'Trasferimento' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Uscita' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Duplica' }).click()
  await expect(page.getByRole('status').filter({ hasText: /Duplicato: 10,00\s€ · Contanti → Banca/ })).toBeVisible()
})

test('the account selector filters the Home and Movimenti, and they agree', async ({ page }) => {
  await createAccount(page, 'Banca')
  await linkPayment(page, 'Carta', 'Banca')
  await addExpense(page, ['1', '0'], 'Spesa', 'Carta')
  await addExpense(page, ['2', '0'], 'Casa', 'Contanti')

  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Rendiconto' })).toContainText('−30,00')
  await page.getByRole('button', { name: 'Conto: Tutti i conti' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^Banca/ }).click()
  await expect(page.getByRole('region', { name: 'Rendiconto' })).toContainText('−10,00')

  await page.getByRole('navigation').getByRole('link', { name: 'Movimenti' }).click()
  await expect(page.getByRole('button', { name: 'Conto: Banca' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Spesa/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Casa/ })).toHaveCount(0)
})

test('filters by payment method', async ({ page }) => {
  await addExpense(page, ['1', '0'], 'Spesa', 'Carta')
  await addExpense(page, ['2', '0'], 'Casa', 'Satispay')

  await page.goto('/movimenti')
  await page.getByRole('button', { name: 'Pagamento' }).click()
  await page.getByRole('dialog').getByText('Satispay').click()
  await page.getByRole('button', { name: 'Applica (1)' }).click()
  await expect(page.getByRole('link', { name: /Casa/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Spesa/ })).toHaveCount(0)
})

test('an archived account stays readable in the transactions', async ({ page }) => {
  await createAccount(page, 'Banca')
  await addTransfer(page, ['1', '0'])

  await page.goto('/impostazioni/conti')
  await accountRow(page, 'Banca').click()
  await page.getByRole('button', { name: 'Archivia' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Archiviato: Banca' })).toBeVisible()

  await page.goto('/movimenti')
  await expect(page.getByRole('link', { name: /Trasferimento/ })).toContainText('Contanti → Banca')
  await page.goto('/nuovo/uscita')
  await page.getByRole('button', { name: /^Pagamento: / }).click()
  await expect(page.getByRole('dialog').getByText('Banca')).toHaveCount(0)
})

test('the last account cannot be archived', async ({ page }) => {
  await page.goto('/impostazioni/conti')
  await accountRow(page, 'Contanti').click()
  await expect(page.getByText('È l\'unico conto attivo')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Archivia' })).toHaveCount(0)
})

test('a backup brings back accounts, payment methods and transfers', async ({ page }) => {
  await createAccount(page, 'Banca', '1.000,00')
  await linkPayment(page, 'Carta', 'Banca')
  await addExpense(page, ['2', '5'], 'Spesa', 'Carta')
  await addTransfer(page, ['1', '0'])

  await page.goto('/impostazioni')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Esporta backup/ }).click()
  const backup = (await (await downloading).path())!

  // Changes after the backup: restoring removes them.
  await createAccount(page, 'Da togliere')
  await page.goto('/impostazioni')
  await page.locator('input[type="file"]').setInputFiles(backup)
  await page.getByRole('dialog', { name: 'Ripristinare questo backup?' }).getByRole('button', { name: 'Ripristina' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Backup ripristinato.' })).toBeVisible()

  await page.goto('/impostazioni/conti')
  await expect(page.getByRole('list', { name: 'Conti' }).getByRole('link')).toHaveCount(2)
  await expect(accountRow(page, 'Banca')).toContainText('985,00')
  await page.goto('/nuovo/uscita')
  await expect(page.getByRole('button', { name: 'Pagamento: Carta' })).toBeVisible()
  await page.goto('/movimenti')
  await expect(page.getByRole('link', { name: /Trasferimento/ })).toContainText('Contanti → Banca')
  await expect(page.getByRole('link', { name: /Spesa/ })).toContainText('Carta')
})

test('a backup of the older format restores with the default payment methods', async ({ page }) => {
  // What the app wrote before payment methods: no such table, and a format of 1.
  await page.goto('/impostazioni')
  const tables = await page.evaluate(() => new Promise<{ accounts: unknown, meta: unknown }>((resolve, reject) => {
    const open = indexedDB.open('soldo')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const stores = open.result.transaction(['accounts', 'meta'])
      const accounts = stores.objectStore('accounts').getAll()
      const meta = stores.objectStore('meta').getAll()
      meta.onsuccess = () => {
        open.result.close()
        resolve({ accounts: accounts.result, meta: meta.result })
      }
    }
  }))
  const file = JSON.stringify({
    app: 'soldo',
    format: 1,
    exportedAt: '2026-11-01T10:00:00.000Z',
    appVersion: '0.4.0',
    schemaVersion: 1,
    data: {
      accounts: tables.accounts,
      categories: [],
      transactions: [],
      budgets: [],
      recurrences: [],
      settings: [],
      meta: tables.meta,
    },
  })
  await page.locator('input[type="file"]').setInputFiles({
    name: 'soldo-backup-2026-11-01.json',
    mimeType: 'application/json',
    buffer: Buffer.from(file),
  })
  await page.getByRole('dialog', { name: 'Ripristinare questo backup?' }).getByRole('button', { name: 'Ripristina' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Backup ripristinato.' })).toBeVisible()

  await page.goto('/impostazioni/pagamenti')
  await expect(page.getByRole('list', { name: 'Tipi di pagamento' }).getByRole('link')).toHaveCount(5)
})

baseTest('the data of an older version gets the payment methods and stays as it was', async ({ page }) => {
  // The database as version 0.4.0 left it, written before the app opens it. Dexie multiplies its
  // version by ten, and /privacy is a page of the same site that does not touch the database.
  await page.goto('/privacy')
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('soldo', 10)
    open.onerror = () => reject(open.error)
    open.onupgradeneeded = () => {
      const db = open.result
      db.createObjectStore('accounts', { keyPath: 'id' }).createIndex('order', 'order')
      const categories = db.createObjectStore('categories', { keyPath: 'id' })
      categories.createIndex('kind', 'kind')
      categories.createIndex('order', 'order')
      const transactions = db.createObjectStore('transactions', { keyPath: 'id' })
      for (const index of [
        'date',
        'categoryId',
        'accountId',
        'updatedAt',
        'externalId',
      ])
        transactions.createIndex(index, index)
      transactions.createIndex('[kind+date]', ['kind', 'date'])
      const budgets = db.createObjectStore('budgets', { keyPath: 'id' })
      budgets.createIndex('month', 'month')
      budgets.createIndex('categoryId', 'categoryId')
      db.createObjectStore('recurrences', { keyPath: 'id' })
      db.createObjectStore('settings', { keyPath: 'key' })
      db.createObjectStore('meta', { keyPath: 'key' })
    }
    open.onsuccess = () => {
      const stored = open.result.transaction([
        'accounts',
        'categories',
        'transactions',
        'meta',
      ], 'readwrite')
      const stamp = '2026-11-01T10:00:00.000Z'
      const record = { createdAt: stamp, updatedAt: stamp, deletedAt: null }
      stored.objectStore('accounts').add({
        ...record,
        id: 'cash',
        preset: 'cash',
        type: 'cash',
        icon: 'wallet',
        color: 1,
        initialBalanceCents: 5000,
        currency: 'EUR',
        archived: false,
        order: 0,
      })
      stored.objectStore('categories').add({
        ...record,
        id: 'groceries',
        kind: 'expense',
        preset: 'groceries',
        icon: 'shopping-cart',
        color: 1,
        order: 0,
        archived: false,
      })
      stored.objectStore('transactions').add({
        ...record,
        id: 'old',
        kind: 'expense',
        amountCents: 1240,
        currency: 'EUR',
        date: '2026-11-01',
        accountId: 'cash',
        categoryId: 'groceries',
        note: 'Esselunga',
        source: 'manual',
      })
      stored.objectStore('meta').add({ key: 'onboardedAt', value: stamp })
      stored.oncomplete = () => {
        open.result.close()
        resolve()
      }
      stored.onerror = () => reject(stored.error)
    }
  }))

  await page.goto('/impostazioni/pagamenti')
  await expect(page.getByRole('list', { name: 'Tipi di pagamento' }).getByRole('link')).toHaveCount(5)

  await page.goto('/movimenti')
  await expect(page.getByRole('link', { name: /Esselunga/ })).toContainText('Spesa · Contanti')

  await page.goto('/impostazioni/conti')
  await expect(accountRow(page, 'Contanti')).toContainText('37,60')

  // Nothing says how the old expense was paid, until it is said.
  await page.goto('/movimenti')
  await page.getByRole('link', { name: /Esselunga/ }).click()
  await expect(page.getByRole('button', { name: 'Pagamento', exact: true })).toBeVisible()
})
