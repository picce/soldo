import { expect, test } from './fixtures'

test.describe('on a device in English', () => {
  test.use({ locale: 'en-US' })

  test('starts in English', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(nav.getByRole('link', { name: 'Transactions' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })
})

test('keeps the language picked in Settings after a reload', async ({ page }) => {
  await page.goto('/impostazioni')
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await expect(page).toHaveTitle('Settings · Soldo')

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})
