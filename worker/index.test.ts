import { describe, expect, it } from 'vitest'
import worker from './index'

function call(path: string) {
  return worker.fetch(new Request(`https://soldo.test${path}`))
}

describe('worker', () => {
  it('risponde all\'health check', async () => {
    const response = await call('/api/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, service: 'soldo' })
  })

  it('restituisce 404 sulle rotte API sconosciute', async () => {
    const response = await call('/api/sconosciuta')
    expect(response.status).toBe(404)
  })
})
