import { describe, expect, it } from 'vitest'
import worker from './index'

function call(path: string) {
  return worker.fetch(new Request(`https://soldo.test${path}`), {} as Env)
}

describe('worker', () => {
  it('answers the health check', async () => {
    const response = await call('/api/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, service: 'soldo' })
  })

  it('returns 404 on unknown API routes', async () => {
    const response = await call('/api/unknown')
    expect(response.status).toBe(404)
  })

  it('sends a shared file back to the import page, without reading it', async () => {
    const response = await worker.fetch(new Request('https://soldo.test/api/share-target', { method: 'POST', body: 'x' }), {} as Env)
    expect(response.status).toBe(303)
    expect(response.headers.get('Location')).toBe('https://soldo.test/impostazioni/importa?condiviso=1')
  })
})
