import { clearCookie, randomToken, readCookie, seal, serializeCookie, sha256, toBase64Url, unseal } from './cookies'

/**
 * Google Drive sign-in for the backup (docs/specs/backup-google-drive.md, "Worker"). Google
 * gives a refresh token only to a client with a secret, so the Worker keeps the secret and
 * the refresh token, sealed in a cookie only it can read, and hands the app short-lived
 * access tokens. The app talks to the Drive API itself: no expense data passes through here.
 */

/** Secrets set with `wrangler secret put` (docs/google-drive.md); in development `.dev.vars`. */
export interface GoogleSecrets {
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  COOKIE_SECRET?: string
}

type Config = Required<GoogleSecrets>

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
/** Only the files Soldo creates: a non-sensitive scope. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

const COOKIE_PATH = '/api/google'
/** The refresh token: sent only by the app's own requests. */
export const SESSION_COOKIE = '__Secure-soldo-google'
/** State and PKCE verifier of a sign-in in progress: must come back from Google's redirect. */
export const FLOW_COOKIE = '__Secure-soldo-oauth'
/** Browsers cap cookies at 400 days; every access token renews it. */
const SESSION_AGE = 400 * 24 * 60 * 60
const FLOW_AGE = 10 * 60
const DEFAULT_RETURN = '/impostazioni'

interface Flow {
  state: string
  verifier: string
  returnTo: string
  expiresAt: number
}

interface Session {
  refreshToken: string
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  error?: string
}

/** How the sign-in ended, appended to the return path as `?google=…`. */
export type ConnectOutcome = 'connected' | 'denied' | 'scope' | 'error' | 'unavailable'

function configOf(env: GoogleSecrets): Config | undefined {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, COOKIE_SECRET } = env
  return GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && COOKIE_SECRET
    ? { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, COOKIE_SECRET }
    : undefined
}

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  })
}

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ 'Location': location, 'Cache-Control': 'no-store' })
  for (const cookie of cookies)
    headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 302, headers })
}

/** A path of the app, never another site: `/benvenuto?ripristina=drive` yes, `//evil.test` no. */
export function safeReturnPath(value: string | null): string {
  if (!value || value.length > 200 || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\') || value.startsWith('/api/'))
    return DEFAULT_RETURN
  return value
}

function backTo(origin: string, path: string, outcome: ConnectOutcome): string {
  const target = new URL(path, origin)
  target.searchParams.set('google', outcome)
  return target.href
}

/** POSTs come only from the app's own pages, so another site cannot spend the cookie. */
function sameOrigin(request: Request, url: URL): boolean {
  return request.headers.get('Origin') === url.origin
}

async function callGoogle(endpoint: string, form: Record<string, string>): Promise<{ status: number, body: TokenResponse }> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  })
  const body = await response.json().catch(() => ({})) as TokenResponse
  return { status: response.status, body }
}

async function sessionCookie(config: Config, session: Session): Promise<string> {
  return serializeCookie(SESSION_COOKIE, await seal(config.COOKIE_SECRET, SESSION_COOKIE, session), {
    path: COOKIE_PATH,
    maxAge: SESSION_AGE,
    sameSite: 'Strict',
  })
}

const clearSession = clearCookie(SESSION_COOKIE, { path: COOKIE_PATH, sameSite: 'Strict' })
const clearFlow = clearCookie(FLOW_COOKIE, { path: COOKIE_PATH, sameSite: 'Lax' })

async function readSession(request: Request, config: Config): Promise<Session | undefined> {
  const sealed = readCookie(request, SESSION_COOKIE)
  return sealed
    ? unseal<Session>(config.COOKIE_SECRET, SESSION_COOKIE, sealed)
    : undefined
}

async function connect(url: URL, config: Config): Promise<Response> {
  const verifier = randomToken()
  const flow: Flow = {
    state: randomToken(16),
    verifier,
    returnTo: safeReturnPath(url.searchParams.get('return')),
    expiresAt: Date.now() + FLOW_AGE * 1000,
  }
  const consent = new URL(AUTH_URL)
  consent.search = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID,
    redirect_uri: `${url.origin}${COOKIE_PATH}/callback`,
    response_type: 'code',
    scope: DRIVE_SCOPE,
    // A refresh token every time, also when the user had already agreed.
    access_type: 'offline',
    prompt: 'consent',
    state: flow.state,
    code_challenge: toBase64Url(await sha256(verifier)),
    code_challenge_method: 'S256',
  }).toString()
  const cookie = serializeCookie(FLOW_COOKIE, await seal(config.COOKIE_SECRET, FLOW_COOKIE, flow), {
    path: COOKIE_PATH,
    maxAge: FLOW_AGE,
    sameSite: 'Lax',
  })
  return redirect(consent.href, [cookie])
}

async function callback(request: Request, url: URL, config: Config): Promise<Response> {
  const sealed = readCookie(request, FLOW_COOKIE)
  const flow = sealed
    ? await unseal<Flow>(config.COOKIE_SECRET, FLOW_COOKIE, sealed)
    : undefined
  if (!flow || flow.expiresAt < Date.now() || flow.state !== url.searchParams.get('state'))
    return redirect(backTo(url.origin, flow?.returnTo ?? DEFAULT_RETURN, 'error'), [clearFlow])
  const end = (outcome: ConnectOutcome, cookies: string[] = []) =>
    redirect(backTo(url.origin, flow.returnTo, outcome), [clearFlow, ...cookies])

  const code = url.searchParams.get('code')
  if (!code) {
    return end(url.searchParams.get('error') === 'access_denied'
      ? 'denied'
      : 'error')
  }
  const { body } = await callGoogle(TOKEN_URL, {
    client_id: config.GOOGLE_CLIENT_ID,
    client_secret: config.GOOGLE_CLIENT_SECRET,
    code,
    code_verifier: flow.verifier,
    grant_type: 'authorization_code',
    redirect_uri: `${url.origin}${COOKIE_PATH}/callback`,
  })
  if (!body.refresh_token)
    return end('error')
  // Google lets the user untick Drive on the consent screen: without it there is no backup.
  if (!body.scope?.split(' ').includes(DRIVE_SCOPE)) {
    await callGoogle(REVOKE_URL, { token: body.refresh_token }).catch(() => undefined)
    return end('scope')
  }
  return end('connected', [await sessionCookie(config, { refreshToken: body.refresh_token })])
}

async function token(request: Request, config: Config): Promise<Response> {
  const session = await readSession(request, config)
  if (!session)
    return json({ error: 'not_connected' }, 401, { 'Set-Cookie': clearSession })
  const { status, body } = await callGoogle(TOKEN_URL, {
    client_id: config.GOOGLE_CLIENT_ID,
    client_secret: config.GOOGLE_CLIENT_SECRET,
    refresh_token: session.refreshToken,
    grant_type: 'refresh_token',
  })
  if (body.error === 'invalid_grant')
    return json({ error: 'revoked' }, 401, { 'Set-Cookie': clearSession })
  if (status !== 200 || !body.access_token)
    return json({ error: 'unavailable' }, 502)
  const renewed = await sessionCookie(config, { refreshToken: body.refresh_token ?? session.refreshToken })
  return json({ accessToken: body.access_token, expiresIn: body.expires_in ?? 3600 }, 200, { 'Set-Cookie': renewed })
}

async function disconnect(request: Request, config: Config): Promise<Response> {
  const session = await readSession(request, config)
  if (session)
    await callGoogle(REVOKE_URL, { token: session.refreshToken }).catch(() => undefined)
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': clearSession, 'Cache-Control': 'no-store' },
  })
}

/** Answers `/api/google/*`; undefined for any other path. */
export async function handleGoogle(request: Request, env: GoogleSecrets): Promise<Response | undefined> {
  const url = new URL(request.url)
  if (!url.pathname.startsWith(`${COOKIE_PATH}/`))
    return undefined
  const route = url.pathname.slice(COOKIE_PATH.length + 1)
  const method = request.method
  const config = configOf(env)

  if (route === 'config' && method === 'GET') {
    return json({
      configured: Boolean(config),
    })
  }
  if (route === 'connect' && method === 'GET') {
    return config
      ? connect(url, config)
      : redirect(backTo(url.origin, safeReturnPath(url.searchParams.get('return')), 'unavailable'))
  }
  if (route === 'callback' && method === 'GET') {
    return config
      ? callback(request, url, config)
      : redirect(backTo(url.origin, DEFAULT_RETURN, 'unavailable'))
  }
  if ((route === 'token' || route === 'disconnect') && method === 'POST') {
    if (!sameOrigin(request, url))
      return json({ error: 'forbidden' }, 403)
    if (!config)
      return json({ error: 'not_configured' }, 503)
    return route === 'token'
      ? token(request, config)
      : disconnect(request, config)
  }
  return json({ error: 'not_found' }, 404)
}
