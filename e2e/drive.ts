import type { Page, Route } from '@playwright/test'
import type { FakeCloud } from '../src/test/fake-cloud'
import type { FakeDrive, FakeRequest, FakeResponse } from '../src/test/fake-drive'
import { Buffer } from 'node:buffer'
import { createFakeCloud } from '../src/test/fake-cloud'
import { createFakeDrive } from '../src/test/fake-drive'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, dropbox-api-arg',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
}

/**
 * Google and the Worker's /api/google routes, played by the fake Drive of the unit tests
 * (src/test/fake-drive.ts). «Collega» comes straight back as if the user had agreed. Pass
 * the same `drive` to two pages to play two devices on one Google account.
 */
/** A Playwright route answered by a fake service of src/test. */
function answerWith(handle: (request: FakeRequest) => Promise<FakeResponse>) {
  return async (route: Route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS })
      return
    }
    const headers = await request.allHeaders()
    const response = await handle({
      method: request.method(),
      url: request.url(),
      contentType: headers['content-type'],
      authorization: headers.authorization,
      headers,
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
}

/** «Collega» comes straight back, as if the user had agreed on the consent screen. */
async function agreeAtOnce(page: Page, service: string) {
  // Registered last, so it wins over the routes of the service for this path.
  await page.route(`**/api/${service}/connect?*`, async (route) => {
    const url = new URL(route.request().url())
    const back = new URL(url.searchParams.get('return') ?? '/impostazioni', url.origin)
    back.searchParams.set(service, 'connected')
    await route.fulfill({
      status: 302,
      headers: { Location: back.href },
    })
  })
}

export async function fakeGoogle(page: Page, drive: FakeDrive = createFakeDrive()): Promise<FakeDrive> {
  const answer = answerWith(drive.handle)
  await page.route('**/api/google/**', answer)
  await page.route('https://www.googleapis.com/**', answer)
  await agreeAtOnce(page, 'google')
  return drive
}

/**
 * Dropbox and the Worker's /api/dropbox routes, played by the fake of src/test/fake-cloud.ts.
 * Pass the same `cloud` to two pages to play two devices on one account.
 */
export async function fakeDropbox(page: Page, cloud: FakeCloud = createFakeCloud('dropbox')): Promise<FakeCloud> {
  const answer = answerWith(cloud.handle)
  await page.route('**/api/dropbox/**', answer)
  await page.route('https://api.dropboxapi.com/**', answer)
  await page.route('https://content.dropboxapi.com/**', answer)
  await agreeAtOnce(page, 'dropbox')
  return cloud
}
