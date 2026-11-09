import type { FakeRequest, FakeResponse } from './fake-drive'

/**
 * Dropbox and OneDrive in memory, with the Worker's /api/<service> routes, for the unit
 * tests (`fakeCloudFetch` in place of `fetch`) and the end-to-end tests (e2e/drive.ts). Each
 * is a folder of files by name: what src/backup/dropbox/dropbox.ts and
 * src/backup/onedrive/onedrive.ts ask, no more. No `@/` imports: the e2e tests load it too.
 */

export type CloudService = 'dropbox' | 'onedrive'

export interface FakeCloudFile {
  bytes: Uint8Array<ArrayBuffer>
  modifiedAt: string
}

function json(body: unknown, status = 200): FakeResponse {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

function text(bytes: Uint8Array | undefined): string {
  return new TextDecoder().decode(bytes ?? new Uint8Array())
}

export function createFakeCloud(service: CloudService) {
  const files = new Map<string, FakeCloudFile>()
  const log: string[] = []
  const queued: FakeResponse[] = []
  let tokens = 0
  /** The permission was withdrawn: every API request answers 401. */
  let revoked = false
  let clock = Date.UTC(2026, 10, 9, 8)

  function write(name: string, bytes: Uint8Array<ArrayBuffer>) {
    files.set(name, {
      bytes,
      modifiedAt: new Date(clock++).toISOString(),
    })
  }

  function dropbox(request: FakeRequest, path: string): FakeResponse {
    const notFound = () => json({ error_summary: 'path/not_found/..' }, 409)
    const arg = (): { path?: string } => JSON.parse(request.headers?.['dropbox-api-arg'] || text(request.body) || '{}') as { path?: string }
    const name = () => (arg().path ?? '').replace(/^\//, '')
    if (path === '/2/users/get_current_account')
      return json({ email: 'anna@example.com' })
    if (path === '/2/files/list_folder') {
      return json({
        entries: [...files].map(([fileName, file]) => ({ '.tag': 'file', 'name': fileName, 'server_modified': file.modifiedAt })),
        cursor: 'end',
        has_more: false,
      })
    }
    if (path === '/2/files/download') {
      const file = files.get(name())
      return file
        ? { status: 200, contentType: 'application/octet-stream', body: file.bytes }
        : notFound()
    }
    if (path === '/2/files/upload') {
      write(name(), Uint8Array.from(request.body ?? []))
      return json({
        name: name(),
      })
    }
    if (path === '/2/files/delete_v2') {
      return files.delete(name())
        ? json({})
        : notFound()
    }
    return json({ error_summary: 'unknown' }, 400)
  }

  function onedrive(request: FakeRequest, url: URL): FakeResponse {
    const root = '/v1.0/me/drive/special/approot'
    const path = decodeURIComponent(url.pathname)
    if (path === '/v1.0/me')
      return json({ mail: 'anna@example.com' })
    if (path === `${root}/children`) {
      return json({
        value: [...files].map(([fileName, file]) => ({ name: fileName, lastModifiedDateTime: file.modifiedAt, file: {} })),
      })
    }
    const match = /^\/v1\.0\/me\/drive\/special\/approot:\/([^:]+)(:\/content)?$/.exec(path)
    if (!match) {
      return json({
        error: { code: 'itemNotFound' },
      }, 404)
    }
    const name = match[1]!
    if (match[2] && request.method === 'PUT') {
      write(name, Uint8Array.from(request.body ?? []))
      return json({ name }, 201)
    }
    const file = files.get(name)
    if (!file) {
      return json({
        error: { code: 'itemNotFound' },
      }, 404)
    }
    if (request.method === 'DELETE') {
      files.delete(name)
      return { status: 204 }
    }
    return json({ 'id': name, '@microsoft.graph.downloadUrl': `https://download.1drv.com/${encodeURIComponent(name)}` })
  }

  async function handle(request: FakeRequest): Promise<FakeResponse> {
    const url = new URL(request.url, 'https://soldo.test')
    const path = url.pathname
    log.push(`${request.method} ${url.host}${path}`)

    if (path === `/api/${service}/config`)
      return json({ configured: true })
    if (path === `/api/${service}/token`) {
      tokens++
      return json({ accessToken: `token-${tokens}`, expiresIn: 3600 })
    }
    if (path === `/api/${service}/disconnect`)
      return { status: 204 }
    // The short-lived download address of OneDrive: no token.
    if (url.host === 'download.1drv.com') {
      const file = files.get(decodeURIComponent(path.slice(1)))
      return file
        ? { status: 200, contentType: 'application/octet-stream', body: file.bytes }
        : { status: 404 }
    }

    const next = queued.shift()
    if (next)
      return next
    if (revoked || !request.authorization?.startsWith('Bearer token-')) {
      return json({
        error: { code: 'InvalidAuthenticationToken' },
      }, 401)
    }
    return service === 'dropbox'
      ? dropbox(request, path)
      : onedrive(request, url)
  }

  return {
    service,
    handle,
    files,
    /** Every request, as `METHOD host/path`. */
    log,
    /** Answers the next API request with `response`, whatever it is. */
    queue(response: FakeResponse) {
      queued.push(response)
    },
    /** The backup files, without the index. */
    backups(): string[] {
      return [
        ...files.keys(),
      ].filter(name => name.startsWith('soldo-backup-')).sort()
    },
    /** Withdraws the permission: the API answers 401 from now on. */
    revoke() {
      revoked = true
    },
    get tokens() {
      return tokens
    },
  }
}

export type FakeCloud = ReturnType<typeof createFakeCloud>

/** `fetch` answered by a fake cloud, for the unit tests. */
export function fakeCloudFetch(cloud: FakeCloud) {
  return async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url
    const headers = new Headers(init.headers)
    let body: Uint8Array | undefined
    if (init.body instanceof Uint8Array)
      body = init.body
    else if (init.body instanceof Blob)
      body = new Uint8Array(await init.body.arrayBuffer())
    else if (typeof init.body === 'string')
      body = new TextEncoder().encode(init.body)
    const response = await cloud.handle({
      method: init.method ?? 'GET',
      url,
      contentType: headers.get('Content-Type') ?? undefined,
      authorization: headers.get('Authorization') ?? undefined,
      headers: Object.fromEntries([...headers].map(([name, value]) => [
        name.toLowerCase(),
        value,
      ])),
      body,
    })
    return new Response(response.body ?? null, {
      status: response.status,
      headers: response.contentType
        ? { 'Content-Type': response.contentType }
        : {},
    })
  }
}
