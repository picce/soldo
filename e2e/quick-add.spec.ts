import type { Page } from '@playwright/test'
import { expect, pageSettled, test } from './fixtures'

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

test('offers a "Nuova uscita" shortcut in the manifest, for an app that stays upright', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifest = await (await request.get(href!)).json()
  expect(manifest.orientation).toBe('portrait')
  expect(manifest.shortcuts).toEqual([
    expect.objectContaining({ name: 'Nuova uscita', url: '/nuovo/uscita' }),
  ])
  const icon = await request.get(manifest.shortcuts[0].icons[0].src)
  expect(icon.ok()).toBe(true)
})

test('on a short screen every category is above the keypad, with keys still big enough', async ({ page }) => {
  // A 360px phone in the browser, with its bars: about 640px left for the page.
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/nuovo/uscita')
  const keypad = page.getByRole('group', { name: 'Tastierino' })
  await expect(page.getByRole('button', { name: 'Altro', exact: true })).toBeVisible()
  const lastCategory = (await page.getByRole('button', { name: 'Altro', exact: true }).boundingBox())!
  const keys = (await keypad.boundingBox())!
  expect(lastCategory.y + lastCategory.height).toBeLessThanOrEqual(keys.y)
  const key = (await keypad.getByRole('button', { name: '7', exact: true }).boundingBox())!
  expect(key.height).toBeGreaterThanOrEqual(44)
})

test('«Uscita» is one tap away on the other tabs, and closing goes back to them', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Navigazione principale' })
  const add = page.getByRole('link', { name: 'Nuova uscita' })
  // The Home has its two buttons, the Settings none.
  await expect(add).toHaveCount(0)
  // The button is on each of these pages: wait for the page, not for the button.
  for (const [tab, path] of [['Budget', /\/budget$/], ['Statistiche', /\/statistiche$/], ['Movimenti', /\/movimenti$/]] as const) {
    await nav.getByRole('link', { name: tab }).click()
    await expect(page).toHaveURL(path)
    await expect(add).toBeVisible()
    await pageSettled(page)
  }
  await add.click()
  await expect(page.getByRole('group', { name: 'Tastierino' })).toBeVisible()
  // In the page: the notice «pronta per l'uso offline» has a «Chiudi» too.
  await page.getByRole('main').getByRole('button', { name: 'Chiudi' }).click()
  await expect(page).toHaveURL(/\/movimenti$/)

  await add.click()
  await typeAmount(page, ['4'])
  await page.getByRole('button', { name: 'Spesa', exact: true }).click()
  await expect(notice(page, /Salvato/)).toBeVisible()
  await expect(page).toHaveURL(/\/movimenti$/)

  await nav.getByRole('link', { name: 'Impostazioni' }).click()
  await expect(add).toHaveCount(0)
})

test('opens on the keypad when asked, and on the Home after a reload', async ({ page, context }) => {
  await page.goto('/impostazioni')
  const start = page.getByRole('group', { name: 'All\'apertura' })
  await expect(start.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-pressed', 'true')
  await start.getByRole('button', { name: 'Nuova uscita' }).click()

  // The app is opened again: a new tab is a new session.
  const opened = await context.newPage()
  await opened.goto('/')
  await expect(opened).toHaveURL(/\/nuovo\/uscita$/)
  await typeAmount(opened, ['9'])
  await opened.getByRole('button', { name: 'Casa', exact: true }).click()
  await expect(notice(opened, /Salvato/)).toBeVisible()
  await expect(opened.getByRole('tablist', { name: 'Periodo' })).toBeVisible()

  await opened.reload()
  await expect(opened.getByRole('tablist', { name: 'Periodo' })).toBeVisible()
  await expect(opened).toHaveURL(/\/$/)
})

test('a note is written in the screen, and next time it is one tap away', async ({ page }) => {
  await page.goto('/nuovo/uscita')
  await typeAmount(page, ['3', '2'])
  await page.getByRole('button', { name: 'Nota', exact: true }).click()
  const field = page.getByRole('textbox', { name: 'Nota' })
  await expect(field).toBeFocused()
  // While the note is written the other buttons make room.
  await expect(page.getByRole('button', { name: /^Data/ })).toBeHidden()
  await field.fill('Esselunga')
  // No «Fatto»: the category saves.
  await page.getByRole('button', { name: 'Spesa', exact: true }).click()
  await expect(notice(page, /Salvato/)).toBeVisible()

  await page.goto('/nuovo/uscita')
  await typeAmount(page, ['1', '8'])
  await page.getByRole('button', { name: 'Nota', exact: true }).click()
  await page.getByRole('group', { name: 'Note frequenti' }).getByRole('button', { name: 'Esselunga' }).click()
  await expect(page.getByRole('button', { name: 'Nota: Esselunga' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Data/ })).toBeVisible()
  await page.getByRole('button', { name: 'Spesa', exact: true }).click()
  await expect(notice(page, /Salvato/)).toBeVisible()

  await page.goto('/movimenti')
  await expect(page.getByText('Esselunga')).toHaveCount(2)
})
