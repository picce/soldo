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
})
