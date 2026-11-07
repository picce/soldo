import type { Page } from '@playwright/test'
import { expect, pageSettled, test } from './fixtures'

/** Saturday 7 November 2026, so «allo stesso giorno» has a fixed meaning. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T10:00:00'))
})

type Seed = [kind: 'expense' | 'income', date: string, cents: number, preset: string]

/** Writes transactions straight into the database: typing two months of them would say nothing more. */
async function seed(page: Page, rows: Seed[]) {
  await page.evaluate(rows => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('soldo')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction(['categories', 'accounts', 'transactions'], 'readwrite')
      const categories = tx.objectStore('categories').getAll()
      const accounts = tx.objectStore('accounts').getAll()
      accounts.onsuccess = () => {
        const account = accounts.result[0].id
        rows.forEach(([kind, date, amountCents, preset], index) => {
          const category = categories.result.find((item: { preset: string }) => item.preset === preset)
          tx.objectStore('transactions').put({
            id: `seed-${index}`,
            createdAt: `${date}T10:00:00.000Z`,
            updatedAt: `${date}T10:00:00.000Z`,
            deletedAt: null,
            kind,
            amountCents,
            currency: 'EUR',
            date,
            accountId: account,
            categoryId: category.id,
            note: '',
          })
        })
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }
  }), rows)
}

/** Taps the chart at a share of its plot, from the left. */
async function tapChart(page: Page, name: string, share: number) {
  const chart = page.getByRole('group', { name })
  const box = (await chart.boundingBox())!
  // The plot starts after the values of the axis (44px) and stops 8px from the right.
  await chart.tap({
    position: { x: 44 + (box.width - 52) * share, y: 60 },
  })
}

test('the month against the same days of October, a day of the chart, a category and its transactions', async ({ page }) => {
  await seed(page, [
    [
      'expense',
      '2026-10-02',
      5000,
      'groceries',
    ],
    [
      'expense',
      '2026-10-06',
      3000,
      'groceries',
    ],
    [
      'expense',
      '2026-10-20',
      9000,
      'groceries',
    ],
    [
      'expense',
      '2026-11-03',
      9000,
      'groceries',
    ],
    [
      'expense',
      '2026-11-05',
      4000,
      'restaurants',
    ],
    [
      'income',
      '2026-11-01',
      185000,
      'salary',
    ],
  ])
  await page.goto('/statistiche')
  await expect(page.getByRole('heading', { level: 2, name: 'Novembre 2026' })).toBeVisible()
  const expenses = page.getByRole('region', { name: 'Uscite', exact: true })
  await expect(expenses).toContainText('130,00 €')
  await expect(expenses).toContainText('rispetto a 1–7 ottobre')

  await tapChart(page, 'Uscite accumulate giorno per giorno', 5 / 29)
  await expect(page.getByRole('region', { name: 'Giorno per giorno' })).toContainText('6 nov')

  await page.getByRole('link', { name: /^Spesa/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Spesa' })).toBeVisible()
  await expect(page.getByText('90,00 € finora')).toBeVisible()
  await page.getByRole('link', { name: 'Vedi i movimenti di novembre' }).click()
  await expect(page).toHaveURL(/\/movimenti\?categoria=.+&dal=2026-11-01&al=2026-11-30/)
})

test('the year month by month opens a month', async ({ page }) => {
  await seed(page, [
    [
      'expense',
      '2026-10-02',
      5000,
      'groceries',
    ],
    [
      'expense',
      '2026-11-03',
      9000,
      'groceries',
    ],
  ])
  await page.goto('/statistiche')
  await page.getByRole('tab', { name: 'Anno' }).click()
  await expect(page.getByRole('heading', { level: 2, name: '2026' })).toBeVisible()
  await pageSettled(page)
  await tapChart(page, 'Entrate e uscite mese per mese', 9.5 / 12)
  await page.getByRole('link', { name: 'Apri ottobre' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Ottobre 2026' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Uscite', exact: true })).toContainText('50,00 €')
})

test('says what is coming when there is nothing to compare', async ({ page }) => {
  await page.goto('/statistiche')
  await expect(page.getByText('Ancora niente da confrontare')).toBeVisible()
  await page.getByRole('link', { name: 'Aggiungi una spesa' }).click()
  await expect(page).toHaveURL(/\/nuovo\/uscita$/)
})
