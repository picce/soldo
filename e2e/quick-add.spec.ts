import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

interface StoredTransaction {
  id: string
  amountCents: number
  deletedAt: string | null
}

/** Transactions as stored in IndexedDB, read directly (the list screen comes with the Movimenti spec). */
async function storedTransactions(page: Page): Promise<StoredTransaction[]> {
  return page.evaluate(() => new Promise<StoredTransaction[]>((resolve, reject) => {
    const request = indexedDB.open('soldo')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const read = request.result.transaction('transactions').objectStore('transactions').getAll()
      read.onsuccess = () => {
        request.result.close()
        resolve(read.result)
      }
    }
  }))
}

async function typeAmount(page: Page, keys: string[]) {
  const keypad = page.getByRole('group', { name: 'Tastierino' })
  for (const key of keys)
    await keypad.getByRole('button', { name: key, exact: true }).click()
}

function notice(page: Page, text: RegExp) {
  return page.getByRole('status').filter({ hasText: text })
}

test('adds an expense offline and keeps it after a reload', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await context.setOffline(true)

  await page.goto('/nuovo/uscita')
  await expect(page.getByRole('heading', { level: 1, name: 'Nuova uscita' })).toBeAttached()
  await typeAmount(page, ['1', '2', 'Virgola', '5'])
  await page.getByRole('button', { name: 'Ristoranti', exact: true }).click()

  await expect(notice(page, /Salvato: −12,50\s€ · Ristoranti/)).toBeVisible()
  await expect(page).toHaveURL(/\/$/)

  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Navigazione principale' })).toBeVisible()
  const stored = await storedTransactions(page)
  expect(stored).toHaveLength(1)
  expect(stored[0]).toMatchObject({ amountCents: 1250, deletedAt: null })
})

test('edits a transaction, then deletes it and undoes', async ({ page }) => {
  await page.goto('/nuovo/uscita')
  await typeAmount(page, [
    '8',
    'Virgola',
    '9',
    'Più',
    '3',
    'Virgola',
    '5',
  ])
  await expect(page.getByText('8,9 + 3,5')).toBeVisible()
  await page.getByRole('button', { name: 'Spesa', exact: true }).click()
  await expect(notice(page, /Salvato: −12,40\s€ · Spesa/)).toBeVisible()
  const [{ id }] = await storedTransactions(page)

  await page.goto(`/movimenti/${id}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Modifica movimento' })).toBeAttached()
  await expect(page.getByRole('button', { name: 'Spesa', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await typeAmount(page, ['7'])
  await page.getByRole('button', { name: 'Casa', exact: true }).click()
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(notice(page, /Salvato: −7,00\s€ · Casa/)).toBeVisible()
  expect((await storedTransactions(page))[0]?.amountCents).toBe(700)

  await page.goto(`/movimenti/${id}`)
  await page.getByRole('button', { name: 'Elimina movimento' }).click()
  await expect(notice(page, /Eliminato: −7,00\s€ · Casa/)).toBeVisible()
  expect((await storedTransactions(page))[0]?.deletedAt).not.toBeNull()

  await page.getByRole('button', { name: 'Annulla' }).click()
  await expect.poll(async () => (await storedTransactions(page))[0]?.deletedAt).toBeNull()
})

test('offers a "Nuova uscita" shortcut in the manifest', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifest = await (await request.get(href!)).json()
  expect(manifest.shortcuts).toEqual([
    expect.objectContaining({ name: 'Nuova uscita', url: '/nuovo/uscita' }),
  ])
  const icon = await request.get(manifest.shortcuts[0].icons[0].src)
  expect(icon.ok()).toBe(true)
})
