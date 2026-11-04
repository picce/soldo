import { expect, test } from '@playwright/test'

test('mostra la navigazione e cambia sezione', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Navigazione principale' })
  await expect(nav).toBeVisible()

  await nav.getByRole('link', { name: 'Movimenti' }).click()
  await expect(page).toHaveURL(/\/movimenti$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Movimenti' })).toBeVisible()
  await expect(page).toHaveTitle('Movimenti · Soldo')
})

test('espone il manifest per l\'installazione', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()

  const manifest = await (await request.get(href!)).json()
  expect(manifest.name).toBe('Soldo')
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(true)
})

test('funziona offline dopo la prima visita', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })

  await context.setOffline(true)

  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Navigazione principale' })).toBeVisible()

  // Un deep link mai visitato deve essere servito dal service worker (navigateFallback).
  await page.goto('/statistiche')
  await expect(page.getByRole('heading', { level: 1, name: 'Statistiche' })).toBeVisible()
})

test('l\'API del Worker risponde', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.ok()).toBe(true)
  expect(await response.json()).toEqual({ ok: true, service: 'soldo' })
})
