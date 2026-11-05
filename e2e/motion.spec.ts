import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

declare global {
  interface Window {
    /** Kind of every page transition started, recorded by `recordTransitions`. */
    __pageTransitions: string[]
  }
}

/** From the next page load on, records the kind of every view transition the app starts. */
async function recordTransitions(page: Page) {
  await page.addInitScript(() => {
    window.__pageTransitions = []
    if (!document.startViewTransition)
      return
    const start = document.startViewTransition.bind(document)
    document.startViewTransition = ((update?: ViewTransitionUpdateCallback) => {
      window.__pageTransitions.push(document.documentElement.dataset.pageTransition ?? '')
      return start(update)
    }) as typeof document.startViewTransition
  })
  await page.goto('/')
  // The Home is drawn: the first navigation is over, the next ones animate.
  await expect(page.getByRole('tablist', { name: 'Periodo' })).toBeVisible()
}

function transitions(page: Page) {
  return page.evaluate(() => window.__pageTransitions)
}

test('pages fade, slide and rise into each other', async ({ page }) => {
  await recordTransitions(page)
  const nav = page.getByRole('navigation')

  await nav.getByRole('link', { name: 'Movimenti' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Movimenti' })).toBeVisible()
  await nav.getByRole('link', { name: 'Impostazioni' }).click()
  await page.getByRole('link', { name: /Uscite ed entrate/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Categorie' })).toBeVisible()
  await page.getByRole('button', { name: 'Indietro' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Impostazioni' })).toBeVisible()
  await nav.getByRole('link', { name: 'Home' }).click()
  await page.getByRole('link', { name: 'Uscita', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Tastierino' })).toBeVisible()
  await page.getByRole('button', { name: 'Chiudi' }).click()
  await expect(page.getByRole('tablist', { name: 'Periodo' })).toBeVisible()

  await expect.poll(() => transitions(page)).toEqual([
    'fade',
    'fade',
    'push',
    'pop',
    'fade',
    'modal-open',
    'modal-close',
  ])
})

test.describe('with «Riduci movimento»', () => {
  test.use({ reducedMotion: 'reduce' })

  test('pages change at once', async ({ page }) => {
    await recordTransitions(page)
    const nav = page.getByRole('navigation')
    await nav.getByRole('link', { name: 'Movimenti' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Movimenti' })).toBeVisible()
    await page.goto('/impostazioni')
    await page.getByRole('link', { name: /Uscite ed entrate/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Categorie' })).toBeVisible()
    expect(await transitions(page)).toEqual([])
  })
})

test('a sheet closes by dragging its head down', async ({ page }) => {
  await page.goto('/nuovo/uscita')
  await page.getByRole('button', { name: /^Data:/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Data' })
  await expect(sheet).toBeVisible()

  // A short drag: the sheet goes back up.
  const title = await sheet.getByRole('heading', { name: 'Data' }).boundingBox()
  const x = title!.x + 10
  const y = title!.y + title!.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 30, { steps: 5 })
  await page.waitForTimeout(150)
  await page.mouse.up()
  await expect(sheet).toBeVisible()

  // Past a quarter of its height: it closes.
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 40, { steps: 5 })
  await page.mouse.move(x, y + 300, { steps: 10 })
  await page.mouse.up()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('group', { name: 'Tastierino' })).toBeVisible()
})
