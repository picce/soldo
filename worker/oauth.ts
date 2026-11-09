import { clearCookie, randomToken, readCookie, seal, serializeCookie, sha256, toBase64Url, unseal } from './cookies'

/**
 * Sign-in to a backup service for the app (docs/specs/backup-google-drive.md, "Worker";
 * docs/specs/backup-dropbox-onedrive.md). The services give a long-lived refresh token only
 * to a client with a secret, so the Worker keeps the secret and the refresh token, sealed
 * in a cookie only it can read, and hands the app short-lived access tokens. The app talks
 * to the service's API itself: no expense data passes through here.
 *
 * Routes, under `/api/<service>/`: `config` (is it configured), `connect` (to the consent
 * screen), `callback` (back from it), `token` and `disconnect` (POST, only from the app).
 */

export interface Credentials {
  clientId: string
  clientSecret: string
  cookieSecret: string
}

export interface TokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  error?: string
}

export interface OAuthService {
  /** `/api/<id>/…`, and `?<id>=…` on the way back to the app. */
  id: string
  /** The cookie with the refresh token. */
  sessionCookie: string
  authUrl: string
  tokenUrl: string
  scope: string
  /** Extra parameters of the consent screen, e.g. to get a refresh token. */
  authParams?: Record<string, string>
  credentials: (env: Record<string, unknown>) => Credentials | undefined
  /** The user may untick a permission on the consent screen: true when all are there. */
  granted?: (body: TokenResponse) => boolean
  /** Withdraws the permission at the service, when it can. */
  revoke?: (refreshToken: string, credentials: Credentials) => Promise<void>
}

/** State and PKCE verifier of a sign-in in progress: must come back from the redirect. */
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

/** How the sign-in ended, appended to the return path as `?<service>=…`. */
export type ConnectOutcome = 'connected' | 'denied' | 'scope' | 'error' | 'unavailable'

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

/** POSTs come only from the app's own pages, so another site cannot spend the cookie. */
function sameOrigin(request: Request, url: URL): boolean {
  return request.headers.get('Origin') === url.origin
}

/** A form POST to a token or revoke endpoint. */
export async function postForm(endpoint: string, form: Record<string, string>): Promise<{ status: number, body: TokenResponse }> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  })
  const body = await response.json().catch(() => ({})) as TokenResponse
  return { status: response.status, body }
}

/** A new access token from the refresh token. */
export function refresh(service: OAuthService, refreshToken: string, credentials: Credentials) {
  return postForm(service.tokenUrl, {
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
}

class Handler {
  private readonly path: string
  private readonly clearSession: string
  private readonly clearFlow: string

  constructor(private readonly service: OAuthService, private readonly config: Credentials) {
    this.path = `/api/${service.id}`
    this.clearSession = clearCookie(service.sessionCookie, { path: this.path, sameSite: 'Strict' })
    this.clearFlow = clearCookie(FLOW_COOKIE, { path: this.path, sameSite: 'Lax' })
  }

  backTo(origin: string, path: string, outcome: ConnectOutcome): string {
    return backTo(this.service, origin, path, outcome)
  }

  private redirectUri(url: URL): string {
    return `${url.origin}${this.path}/callback`
  }

  private async sessionCookie(session: Session): Promise<string> {
    const name = this.service.sessionCookie
    return serializeCookie(name, await seal(this.config.cookieSecret, name, session), {
      path: this.path,
      maxAge: SESSION_AGE,
      sameSite: 'Strict',
    })
  }

  private async readSession(request: Request): Promise<Session | undefined> {
    const name = this.service.sessionCookie
    const sealed = readCookie(request, name)
    return sealed
      ? unseal<Session>(this.config.cookieSecret, name, sealed)
      : undefined
  }

  async connect(url: URL): Promise<Response> {
    const verifier = randomToken()
    const flow: Flow = {
      state: randomToken(16),
      verifier,
      returnTo: safeReturnPath(url.searchParams.get('return')),
      expiresAt: Date.now() + FLOW_AGE * 1000,
    }
    const consent = new URL(this.service.authUrl)
    consent.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.redirectUri(url),
      response_type: 'code',
      scope: this.service.scope,
      ...this.service.authParams,
      state: flow.state,
      code_challenge: toBase64Url(await sha256(verifier)),
      code_challenge_method: 'S256',
    }).toString()
    const cookie = serializeCookie(FLOW_COOKIE, await seal(this.config.cookieSecret, FLOW_COOKIE, flow), {
      path: this.path,
      maxAge: FLOW_AGE,
      sameSite: 'Lax',
    })
    return redirect(consent.href, [cookie])
  }

  async callback(request: Request, url: URL): Promise<Response> {
    const sealed = readCookie(request, FLOW_COOKIE)
    const flow = sealed
      ? await unseal<Flow>(this.config.cookieSecret, FLOW_COOKIE, sealed)
      : undefined
    if (!flow || flow.expiresAt < Date.now() || flow.state !== url.searchParams.get('state'))
      return redirect(this.backTo(url.origin, flow?.returnTo ?? DEFAULT_RETURN, 'error'), [this.clearFlow])
    const end = (outcome: ConnectOutcome, cookies: string[] = []) =>
      redirect(this.backTo(url.origin, flow.returnTo, outcome), [this.clearFlow, ...cookies])

    const code = url.searchParams.get('code')
    if (!code) {
      return end(url.searchParams.get('error') === 'access_denied'
        ? 'denied'
        : 'error')
    }
    const { body } = await postForm(this.service.tokenUrl, {
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      code_verifier: flow.verifier,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri(url),
    })
    if (!body.refresh_token)
      return end('error')
    if (this.service.granted && !this.service.granted(body)) {
      await this.service.revoke?.(body.refresh_token, this.config).catch(() => undefined)
      return end('scope')
    }
    return end('connected', [await this.sessionCookie({ refreshToken: body.refresh_token })])
  }

  async token(request: Request): Promise<Response> {
    const session = await this.readSession(request)
    if (!session)
      return json({ error: 'not_connected' }, 401, { 'Set-Cookie': this.clearSession })
    const { status, body } = await refresh(this.service, session.refreshToken, this.config)
    if (body.error === 'invalid_grant')
      return json({ error: 'revoked' }, 401, { 'Set-Cookie': this.clearSession })
    if (status !== 200 || !body.access_token)
      return json({ error: 'unavailable' }, 502)
    // Some services hand out a new refresh token each time (Microsoft): keep the newest.
    const renewed = await this.sessionCookie({ refreshToken: body.refresh_token ?? session.refreshToken })
    return json({ accessToken: body.access_token, expiresIn: body.expires_in ?? 3600 }, 200, { 'Set-Cookie': renewed })
  }

  async disconnect(request: Request): Promise<Response> {
    const session = await this.readSession(request)
    if (session)
      await this.service.revoke?.(session.refreshToken, this.config).catch(() => undefined)
    return new Response(null, {
      status: 204,
      headers: { 'Set-Cookie': this.clearSession, 'Cache-Control': 'no-store' },
    })
  }
}

function backTo(service: OAuthService, origin: string, path: string, outcome: ConnectOutcome): string {
  const target = new URL(path, origin)
  target.searchParams.set(service.id, outcome)
  return target.href
}

/** Answers `/api/<service>/*`; undefined for any other path. */
export async function handleOAuth(service: OAuthService, request: Request, env: Record<string, unknown>): Promise<Response | undefined> {
  const url = new URL(request.url)
  const path = `/api/${service.id}`
  if (!url.pathname.startsWith(`${path}/`))
    return undefined
  const route = url.pathname.slice(path.length + 1)
  const method = request.method
  const config = service.credentials(env)
  const handler = config && new Handler(service, config)

  if (route === 'config' && method === 'GET') {
    return json({
      configured: Boolean(config),
    })
  }
  if (route === 'connect' && method === 'GET') {
    return handler
      ? handler.connect(url)
      : redirect(backTo(service, url.origin, safeReturnPath(url.searchParams.get('return')), 'unavailable'))
  }
  if (route === 'callback' && method === 'GET') {
    return handler
      ? handler.callback(request, url)
      : redirect(backTo(service, url.origin, DEFAULT_RETURN, 'unavailable'))
  }
  if ((route === 'token' || route === 'disconnect') && method === 'POST') {
    if (!sameOrigin(request, url))
      return json({ error: 'forbidden' }, 403)
    if (!handler)
      return json({ error: 'not_configured' }, 503)
    return route === 'token'
      ? handler.token(request)
      : handler.disconnect(request)
  }
  return json({ error: 'not_found' }, 404)
}
