import { afterEach, beforeEach, vi } from 'vitest'

/**
 * Unit tests never reach the network. By default the Worker answers that Google is not
 * configured (src/backup/google/auth.ts asks it), and any other request fails as without
 * network; a test that needs other answers stubs `fetch` itself.
 */
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url
    if (url.endsWith('/api/google/config')) {
      return new Response(JSON.stringify({ configured: false }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw new TypeError('No network in unit tests')
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})
