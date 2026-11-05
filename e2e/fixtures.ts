import type { Page } from '@playwright/test'
import { test as base, expect } from '@playwright/test'

/**
 * Every test starts from a fresh browser, so from the welcome page. This `page` has gone
 * through «Inizia da zero» already, as after the first start; e2e/onboarding.spec.ts tests
 * the welcome itself with the plain Playwright `test`.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.goto('/')
    await page.getByRole('button', { name: /^(Inizia da zero|Start from scratch)$/ }).click()
    await expect(page.getByRole('navigation')).toBeVisible()
    await use(page)
  },
})

export { expect }

/**
 * Waits for the page transition to end (src/app/page-transitions.ts): until then the
 * screen shows images of the two pages, and a drag would not reach the page underneath.
 */
export async function pageSettled(page: Page) {
  await expect(page.locator('html')).not.toHaveAttribute('data-page-transition')
}
