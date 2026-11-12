import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import script from '../../../public/share-target.js?raw'
import { takeSharedStatement } from './shared'

/** Cache Storage in memory, as the service worker and the page share it. */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>()
  return {
    open: async (name: string) => {
      const store = stores.get(name) ?? new Map<string, Response>()
      stores.set(name, store)
      return {
        put: async (url: string, response: Response) => void store.set(url, response),
        match: async (url: string) => store.get(url)?.clone(),
        delete: async (url: string) => store.delete(url),
      }
    },
  }
}

type FetchListener = (event: { request: Request, respondWith: (response: Promise<Response>) => void }) => void

/** Runs public/share-target.js as the service worker does, and returns its fetch listener. */
function loadServiceWorkerScript(): FetchListener {
  let listener: FetchListener | undefined
  const self = {
    location: { origin: 'https://soldo.test' },
    addEventListener: (type: string, callback: FetchListener) => {
      if (type === 'fetch')
        listener = callback
    },
  }
  // eslint-disable-next-line no-new-func
  new Function('globalThis', script)(self)
  return listener!
}

async function share(listener: FetchListener, form: FormData, path = '/api/share-target'): Promise<Response | undefined> {
  let answer: Promise<Response> | undefined
  listener({
    request: new Request(`https://soldo.test${path}`, { method: 'POST', body: form }),
    respondWith: (response) => {
      answer = response
    },
  })
  return answer
}

beforeEach(() => {
  vi.stubGlobal('caches', fakeCaches())
})

afterEach(() => vi.unstubAllGlobals())

describe('a statement shared from another app', () => {
  it('waits in the cache for the import page, which takes it once', async () => {
    const form = new FormData()
    form.append('statement', new File(['Data;Importo'], 'marzo 2026.csv', { type: 'text/csv' }))
    const response = await share(loadServiceWorkerScript(), form)
    expect(response?.status).toBe(303)
    expect(response?.headers.get('Location')).toContain('/impostazioni/importa?condiviso=1')

    const file = await takeSharedStatement()
    expect(file?.name).toBe('marzo 2026.csv')
    expect(await file?.text()).toBe('Data;Importo')
    expect(await takeSharedStatement()).toBeNull()
  })

  it('opens the page even without a file, and leaves other requests alone', async () => {
    const listener = loadServiceWorkerScript()
    expect((await share(listener, new FormData()))?.status).toBe(303)
    expect(await takeSharedStatement()).toBeNull()
    expect(await share(listener, new FormData(), '/api/google/token')).toBeUndefined()
  })
})
