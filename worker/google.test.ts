// @vitest-environment node
import type { GoogleSecrets } from './google'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { seal, sha256, toBase64Url, unseal } from './cookies'
import { DRIVE_SCOPE, FLOW_COOKIE, safeReturnPath, SESSION_COOKIE } from './google'
import worker from './index'

const ORIGIN = 'https://soldo.test'
const SECRETS: GoogleSecrets = {
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  COOKIE_SECRET: 'cookie-secret',
}

function call(path: string, init: RequestInit = {}, env: GoogleSecrets = SECRETS) {
  const request = new Request(`${ORIGIN}${path}`, { redirect: 'manual', ...init }) as Parameters<typeof worker.fetch>[0]
  return worker.fetch(request, env as Env & GoogleSecrets)
}

function post(path: string, cookie?: string, origin = ORIGIN) {
  const headers = new Headers({ Origin: origin })
  if (cookie)
    headers.set('Cookie', cookie)
  return call(path, { method: 'POST', headers })
}

/** `name=value` of a Set-Cookie of the response, ready for a Cookie header. */
function cookieOf(response: Response, name: string): string | undefined {
  return response.headers.getSetCookie()
    .find(cookie => cookie.startsWith(`${name}=`))
    ?.split(';')[0]
}

interface GoogleCall {
  url: string
  form: URLSearchParams
}

/** Google's token and revoke endpoints, answered by `reply`. */
function fakeGoogle(reply: (call: GoogleCall) => { status?: number, body: unknown }) {
  const calls: GoogleCall[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit) => {
    const entry = {
      url: input,
      form: new URLSearchParams(init.body as URLSearchParams),
    }
    calls.push(entry)
    const { status = 200, body } = reply(entry)
    return Response.json(body, { status })
  }))
  return calls
}

async function startFlow(returnTo = '/impostazioni') {
  const response = await call(`/api/google/connect?return=${encodeURIComponent(returnTo)}`)
  const location = new URL(response.headers.get('Location')!)
  return {
    response,
    location,
    state: location.searchParams.get('state')!,
    flowCookie: cookieOf(response, FLOW_COOKIE)!,
  }
}

async function sessionFor(refreshToken: string) {
  return `${SESSION_COOKIE}=${await seal(SECRETS.COOKIE_SECRET!, SESSION_COOKIE, { refreshToken })}`
}

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('google routes', () => {
  it('says whether Google is configured', async () => {
    expect(await (await call('/api/google/config')).json()).toEqual({ configured: true })
    expect(await (await call('/api/google/config', {}, { GOOGLE_CLIENT_ID: 'only-the-id' })).json()).toEqual({ configured: false })
  })

  it('sends the user to Google with PKCE and remembers the flow in a sealed cookie', async () => {
    const { response, location, flowCookie } = await startFlow('/benvenuto?ripristina=drive')
    expect(response.status).toBe(302)
    expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(location.searchParams)).toMatchObject({
      client_id: 'client-id',
      redirect_uri: `${ORIGIN}/api/google/callback`,
      response_type: 'code',
      scope: DRIVE_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      code_challenge_method: 'S256',
    })
    const setCookie = response.headers.getSetCookie().find(cookie => cookie.startsWith(FLOW_COOKIE))!
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=Lax')
    expect(setCookie).toContain('Path=/api/google')
    // The verifier stays in the cookie; Google only sees its hash.
    const flow = await unseal<{ verifier: string, returnTo: string }>('cookie-secret', FLOW_COOKIE, flowCookie.split('=')[1]!)
    expect(flow?.returnTo).toBe('/benvenuto?ripristina=drive')
    expect(location.searchParams.get('code_challenge')).toBe(toBase64Url(await sha256(flow!.verifier)))
  })

  it('goes back with google=unavailable when the secrets are missing', async () => {
    const response = await call('/api/google/connect?return=/benvenuto', {}, {})
    expect(response.headers.get('Location')).toBe(`${ORIGIN}/benvenuto?google=unavailable`)
  })

  it('accepts only paths of the app as the way back', () => {
    expect(safeReturnPath('/benvenuto?ripristina=drive')).toBe('/benvenuto?ripristina=drive')
    expect(safeReturnPath('//evil.test/x')).toBe('/impostazioni')
    expect(safeReturnPath('/\\evil.test')).toBe('/impostazioni')
    expect(safeReturnPath('https://evil.test')).toBe('/impostazioni')
    expect(safeReturnPath('/api/google/token')).toBe('/impostazioni')
    expect(safeReturnPath(null)).toBe('/impostazioni')
  })

  it('exchanges the code and keeps the refresh token in a sealed cookie', async () => {
    const { state, flowCookie } = await startFlow('/benvenuto?ripristina=drive')
    const calls = fakeGoogle(() => ({
      body: {
        access_token: 'access',
        expires_in: 3599,
        refresh_token: 'refresh',
        scope: DRIVE_SCOPE,
      },
    }))
    const response = await call(`/api/google/callback?code=the-code&state=${state}`, {
      headers: { Cookie: flowCookie },
    })

    expect(response.headers.get('Location')).toBe(`${ORIGIN}/benvenuto?ripristina=drive&google=connected`)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://oauth2.googleapis.com/token')
    expect(Object.fromEntries(calls[0]!.form)).toMatchObject({
      client_secret: 'client-secret',
      code: 'the-code',
      grant_type: 'authorization_code',
      redirect_uri: `${ORIGIN}/api/google/callback`,
    })
    const session = response.headers.getSetCookie().find(cookie => cookie.startsWith(`${SESSION_COOKIE}=`))!
    expect(session).toContain('SameSite=Strict')
    expect(session).toContain('HttpOnly')
    expect(session).not.toContain('refresh')
    // The flow cookie is cleared.
    expect(response.headers.getSetCookie().find(cookie => cookie.startsWith(`${FLOW_COOKIE}=`))).toContain('Max-Age=0')
  })

  it('refuses a callback with another state or without the flow cookie', async () => {
    const { flowCookie } = await startFlow()
    const calls = fakeGoogle(() => ({ body: {} }))
    const forged = await call('/api/google/callback?code=x&state=forged', {
      headers: { Cookie: flowCookie },
    })
    expect(forged.headers.get('Location')).toBe(`${ORIGIN}/impostazioni?google=error`)
    const lost = await call('/api/google/callback?code=x&state=y')
    expect(lost.headers.get('Location')).toBe(`${ORIGIN}/impostazioni?google=error`)
    expect(calls).toHaveLength(0)
  })

  it('tells a refusal on the consent screen apart', async () => {
    const { state, flowCookie } = await startFlow()
    const response = await call(`/api/google/callback?error=access_denied&state=${state}`, {
      headers: { Cookie: flowCookie },
    })
    expect(response.headers.get('Location')).toBe(`${ORIGIN}/impostazioni?google=denied`)
  })

  it('gives up and revokes when the user unticked Drive', async () => {
    const { state, flowCookie } = await startFlow()
    const calls = fakeGoogle(({ url }) => ({
      body: url.endsWith('/token')
        ? { access_token: 'a', refresh_token: 'r', scope: 'openid' }
        : {},
    }))
    const response = await call(`/api/google/callback?code=c&state=${state}`, {
      headers: { Cookie: flowCookie },
    })
    expect(response.headers.get('Location')).toBe(`${ORIGIN}/impostazioni?google=scope`)
    expect(cookieOf(response, SESSION_COOKIE)).toBeUndefined()
    expect(calls.map(entry => entry.url)).toEqual([
      'https://oauth2.googleapis.com/token',
      'https://oauth2.googleapis.com/revoke',
    ])
  })

  it('hands out an access token and renews the cookie', async () => {
    const calls = fakeGoogle(() => ({
      body: { access_token: 'fresh', expires_in: 3599 },
    }))
    const response = await post('/api/google/token', await sessionFor('refresh'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ accessToken: 'fresh', expiresIn: 3599 })
    expect(Object.fromEntries(calls[0]!.form)).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'refresh' })
    expect(cookieOf(response, SESSION_COOKIE)).toBeTruthy()
  })

  it('refuses token requests from other sites', async () => {
    const response = await post('/api/google/token', await sessionFor('refresh'), 'https://evil.test')
    expect(response.status).toBe(403)
  })

  it('answers 401 without a valid cookie, and forgets a revoked one', async () => {
    expect((await post('/api/google/token')).status).toBe(401)
    expect((await post('/api/google/token', `${SESSION_COOKIE}=tampered`)).status).toBe(401)
    // A value sealed for the other cookie does not open this one.
    const moved = `${SESSION_COOKIE}=${await seal('cookie-secret', FLOW_COOKIE, { refreshToken: 'r' })}`
    expect((await post('/api/google/token', moved)).status).toBe(401)

    fakeGoogle(() => ({
      status: 400,
      body: { error: 'invalid_grant' },
    }))
    const revoked = await post('/api/google/token', await sessionFor('old'))
    expect(revoked.status).toBe(401)
    expect(await revoked.json()).toEqual({ error: 'revoked' })
    expect(revoked.headers.getSetCookie()[0]).toContain('Max-Age=0')
  })

  it('reports Google being unavailable without dropping the connection', async () => {
    fakeGoogle(() => ({
      status: 500,
      body: { error: 'internal_failure' },
    }))
    const response = await post('/api/google/token', await sessionFor('refresh'))
    expect(response.status).toBe(502)
    expect(response.headers.getSetCookie()).toEqual([])
  })

  it('revokes the token and clears the cookie on disconnect', async () => {
    const calls = fakeGoogle(() => ({ body: {} }))
    const response = await post('/api/google/disconnect', await sessionFor('refresh'))
    expect(response.status).toBe(204)
    expect(calls[0]!.url).toBe('https://oauth2.googleapis.com/revoke')
    expect(calls[0]!.form.get('token')).toBe('refresh')
    expect(response.headers.getSetCookie()[0]).toContain('Max-Age=0')
  })
})
