import { readFileSync } from 'node:fs'
import { expect, test } from './fixtures'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }

test('shows the navigation and switches section', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Navigazione principale' })
  await expect(nav).toBeVisible()

  await nav.getByRole('link', { name: 'Movimenti' }).click()
  await expect(page).toHaveURL(/\/movimenti$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Movimenti' })).toBeVisible()
  await expect(page).toHaveTitle('Movimenti · Soldo')
})

test('shows the logo as the home heading', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Soldo' })).toBeVisible()
})

test('shows the app version in Settings', async ({ page }) => {
  await page.goto('/impostazioni')
  await expect(page.getByText(`Versione ${version}`)).toBeVisible()
})

test('exposes the manifest for installation', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()

  const manifest = await (await request.get(href!)).json()
  expect(manifest.name).toBe('Soldo')
  expect(manifest.display).toBe('standalone')
  expect(manifest.theme_color).toBe('#f5f4ef')
  const purposes = manifest.icons.map((icon: { purpose?: string }) => icon.purpose ?? 'any')
  expect(purposes).toContain('any')
  expect(purposes).toContain('maskable')
})

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })

  await context.setOffline(true)

  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Navigazione principale' })).toBeVisible()

  // A deep link never visited must be served by the service worker (navigateFallback).
  await page.goto('/statistiche')
  await expect(page.getByRole('heading', { level: 1, name: 'Statistiche' })).toBeVisible()
})

test('the Worker API responds', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.ok()).toBe(true)
  expect(await response.json()).toEqual({ ok: true, service: 'soldo' })
})

test('the Worker says whether Google Drive is configured', async ({ request }) => {
  const response = await request.get('/api/google/config')
  expect(response.ok()).toBe(true)
  expect(await response.json()).toHaveProperty('configured')
})

test('opens the privacy page from the settings', async ({ page }) => {
  await page.goto('/impostazioni')
  await page.getByRole('link', { name: /^Privacy/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy di Soldo' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Soldo privacy' })).toBeVisible()
})

test('goes back from the privacy page to the app', async ({ page }) => {
  await page.goto('/privacy')
  await page.getByRole('link', { name: 'Torna a Soldo' }).click()
  await expect(page).toHaveURL(/\/impostazioni$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Impostazioni' })).toBeVisible()
})
