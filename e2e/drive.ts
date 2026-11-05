import type { Page, Route } from '@playwright/test'
import type { FakeDrive } from '../src/test/fake-drive'
import { Buffer } from 'node:buffer'
import { createFakeDrive } from '../src/test/fake-drive'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE',
}

/**
 * Google and the Worker's /api/google routes, played by the fake Drive of the unit tests
 * (src/test/fake-drive.ts). «Collega» comes straight back as if the user had agreed. Pass
 * the same `drive` to two pages to play two devices on one Google account.
 */
export async function fakeGoogle(page: Page, drive: FakeDrive = createFakeDrive()): Promise<FakeDrive> {
  async function answer(route: Route) {
    const request = route.request()
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS })
      return
    }
    const response = await drive.handle({
      method: request.method(),
      url: request.url(),
      contentType: await request.headerValue('content-type') ?? undefined,
      authorization: await request.headerValue('authorization') ?? undefined,
      body: request.postDataBuffer() ?? undefined,
    })
    await route.fulfill({
      status: response.status,
      headers: CORS,
      contentType: response.contentType,
      body: typeof response.body === 'string'
        ? response.body
        : response.body && Buffer.from(response.body),
    })
  }

  await page.route('**/api/google/**', answer)
  await page.route('https://www.googleapis.com/**', answer)
  // Registered last, so it wins over the route above for this path.
  await page.route('**/api/google/connect?*', async (route) => {
    const url = new URL(route.request().url())
    const back = new URL(url.searchParams.get('return') ?? '/impostazioni', url.origin)
    back.searchParams.set('google', 'connected')
    await route.fulfill({
      status: 302,
      headers: { Location: back.href },
    })
  })
  return drive
}
