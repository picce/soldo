// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { seal } from './cookies'
import { DROPBOX_SCOPES } from './dropbox'
import worker from './index'
import { FLOW_COOKIE } from './oauth'
import { ONEDRIVE_SCOPE } from './onedrive'

/** Dropbox and OneDrive on the flow of oauth.ts, tested in full with Google (google.test.ts). */

const ORIGIN = 'https://soldo.test'
const SECRETS = {
  DROPBOX_CLIENT_ID: 'dropbox-id',
  DROPBOX_CLIENT_SECRET: 'dropbox-secret',
  ONEDRIVE_CLIENT_ID: 'onedrive-id',
  ONEDRIVE_CLIENT_SECRET: 'onedrive-secret',
  COOKIE_SECRET: 'cookie-secret',
}

function call(path: string, init: RequestInit = {}, env: Record<string, string> = SECRETS) {
  const request = new Request(`${ORIGIN}${path}`, { redirect: 'manual', ...init }) as Parameters<typeof worker.fetch>[0]
  return worker.fetch(request, env as unknown as Env)
}

interface ServiceCall {
  url: string
  authorization: string | null
  form: URLSearchParams
}

function fakeService(reply: (call: ServiceCall) => unknown) {
  const calls: ServiceCall[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit = {}) => {
    const entry = {
      url: input,
      authorization: new Headers(init.headers).get('Authorization'),
      form: new URLSearchParams(init.body as URLSearchParams),
    }
    calls.push(entry)
    return Response.json(reply(entry))
  }))
  return calls
}

async function callback(service: string, tokens: unknown) {
  const start = await call(`/api/${service}/connect?return=/impostazioni`)
  const location = new URL(start.headers.get('Location')!)
  const flowCookie = start.headers.getSetCookie().find(cookie => cookie.startsWith(FLOW_COOKIE))!.split(';')[0]!
  const calls = fakeService(entry => entry.url.endsWith('/token')
    ? tokens
    : {})
  const response = await call(`/api/${service}/callback?code=c&state=${location.searchParams.get('state')}`, {
    headers: { Cookie: flowCookie },
  })
  return { location, response, calls }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('dropbox routes', () => {
  it('is configured only with its secrets', async () => {
    expect(await (await call('/api/dropbox/config')).json()).toEqual({ configured: true })
    expect(await (await call('/api/dropbox/config', {}, { COOKIE_SECRET: 'x' })).json()).toEqual({ configured: false })
  })

  it('asks Dropbox for a refresh token and the app folder only', async () => {
    const { location, response } = await callback('dropbox', {
      access_token: 'a',
      refresh_token: 'r',
      scope: DROPBOX_SCOPES.join(' '),
    })
    expect(location.origin + location.pathname).toBe('https://www.dropbox.com/oauth2/authorize')
    expect(Object.fromEntries(location.searchParams)).toMatchObject({
      client_id: 'dropbox-id',
      redirect_uri: `${ORIGIN}/api/dropbox/callback`,
      token_access_type: 'offline',
      code_challenge_method: 'S256',
    })
    expect(response.headers.get('Location')).toBe(`${ORIGIN}/impostazioni?dropbox=connected`)
    expect(response.headers.getSetCookie().some(cookie => cookie.startsWith('__Secure-soldo-dropbox=') && cookie.includes('Path=/api/dropbox'))).toBe(true)
  })

  it('gives up and revokes when a permission is missing', async () => {
    const { response, calls } = await callback('dropbox', {
      access_token: 'a',
      refresh_token: 'r',
      scope: 'account_info.read',
    })
    expect(response.headers.get('Location')).toBe(`${ORIGIN}/impostazioni?dropbox=scope`)
    expect(calls.map(entry => entry.url)).toEqual([
      'https://api.dropboxapi.com/oauth2/token',
      'https://api.dropboxapi.com/oauth2/token',
      'https://api.dropboxapi.com/2/auth/token/revoke',
    ])
    expect(calls[2]!.authorization).toBe('Bearer a')
  })

  it('hands out access tokens to the app only', async () => {
    const session = `__Secure-soldo-dropbox=${await seal('cookie-secret', '__Secure-soldo-dropbox', { refreshToken: 'r' })}`
    fakeService(() => ({ access_token: 'fresh', expires_in: 14400 }))
    const response = await call('/api/dropbox/token', {
      method: 'POST',
      headers: { Origin: ORIGIN, Cookie: session },
    })
    expect(await response.json()).toEqual({ accessToken: 'fresh', expiresIn: 14400 })
    const forbidden = await call('/api/dropbox/token', {
      method: 'POST',
      headers: { Origin: 'https://evil.test', Cookie: session },
    })
    expect(forbidden.status).toBe(403)
  })
})

describe('onedrive routes', () => {
  it('signs in with Microsoft for the app folder, keeping the newest refresh token', async () => {
    const { location, response } = await callback('onedrive', {
      access_token: 'a',
      refresh_token: 'r',
      scope: `https://graph.microsoft.com/${ONEDRIVE_SCOPE} https://graph.microsoft.com/User.Read`,
    })
    expect(location.origin + location.pathname).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
    expect(location.searchParams.get('scope')).toBe(`${ONEDRIVE_SCOPE} User.Read offline_access`)
    expect(response.headers.get('Location')).toBe(`${ORIGIN}/impostazioni?onedrive=connected`)

    const session = response.headers.getSetCookie().find(cookie => cookie.startsWith('__Secure-soldo-onedrive='))!.split(';')[0]!
    const calls = fakeService(() => ({ access_token: 'fresh', refresh_token: 'rotated', expires_in: 3600 }))
    const token = await call('/api/onedrive/token', {
      method: 'POST',
      headers: { Origin: ORIGIN, Cookie: session },
    })
    expect(await token.json()).toEqual({ accessToken: 'fresh', expiresIn: 3600 })
    expect(calls[0]!.form.get('refresh_token')).toBe('r')
    expect(token.headers.getSetCookie().some(cookie => cookie.startsWith('__Secure-soldo-onedrive='))).toBe(true)
  })

  it('refuses a sign-in without the app folder', async () => {
    const { response } = await callback('onedrive', { access_token: 'a', refresh_token: 'r', scope: 'User.Read' })
    expect(response.headers.get('Location')).toBe(`${ORIGIN}/impostazioni?onedrive=scope`)
  })

  it('forgets the sign-in on disconnect', async () => {
    const response = await call('/api/onedrive/disconnect', {
      method: 'POST',
      headers: { Origin: ORIGIN },
    })
    expect(response.status).toBe(204)
    expect(response.headers.getSetCookie()[0]).toContain('Max-Age=0')
  })
})
