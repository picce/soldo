/**
 * A Google Drive in memory, with the Worker's /api/google routes, for the unit tests
 * (`fakeDriveFetch` in place of `fetch`) and the end-to-end tests (Playwright routes in
 * e2e/drive.ts). It answers the requests src/backup/google/drive.ts makes, no more.
 * No `@/` imports: the e2e tests load it too.
 */

export interface FakeRequest {
  method: string
  url: string
  contentType?: string
  authorization?: string
  /** Other headers, lowercase (Dropbox puts its arguments in one). */
  headers?: Record<string, string>
  body?: Uint8Array
}

export interface FakeResponse {
  status: number
  contentType?: string
  body?: Uint8Array<ArrayBuffer> | string
}

export interface FakeDriveFile {
  id: string
  name: string
  mimeType: string
  appProperties: Record<string, string>
  parents: string[]
  trashed: boolean
  bytes: Uint8Array<ArrayBuffer>
}

function latin1(bytes: Uint8Array): string {
  let text = ''
  for (const byte of bytes)
    text += String.fromCharCode(byte)
  return text
}

function fromLatin1(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(text, char => char.charCodeAt(0))
}

/** The metadata and the bytes of a `multipart/related` upload. */
function parseMultipart(contentType: string, body: Uint8Array): { metadata: Record<string, unknown>, bytes: Uint8Array<ArrayBuffer> } {
  const boundary = /boundary=([^;]+)/.exec(contentType)?.[1]
  if (!boundary)
    throw new Error('Not a multipart body')
  const parts = latin1(body).split(`--${boundary}`).slice(1, -1).map(part => part.slice(part.indexOf('\r\n\r\n') + 4, part.length - 2))
  return {
    metadata: JSON.parse(new TextDecoder().decode(fromLatin1(parts[0] ?? '{}'))) as Record<string, unknown>,
    bytes: fromLatin1(parts[1] ?? ''),
  }
}

function json(body: unknown, status = 200): FakeResponse {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

export function createFakeDrive() {
  const files = new Map<string, FakeDriveFile>()
  const queued: FakeResponse[] = []
  const log: string[] = []
  let nextId = 1
  let tokens = 0

  function resource(file: FakeDriveFile) {
    return { id: file.id, name: file.name, appProperties: file.appProperties }
  }

  function add(metadata: Record<string, unknown>, bytes: Uint8Array<ArrayBuffer>): FakeDriveFile {
    const file: FakeDriveFile = {
      id: `file-${nextId++}`,
      name: String(metadata.name ?? ''),
      mimeType: String(metadata.mimeType ?? 'application/octet-stream'),
      appProperties: (metadata.appProperties ?? {}) as Record<string, string>,
      parents: (metadata.parents ?? []) as string[],
      trashed: false,
      bytes,
    }
    files.set(file.id, file)
    return file
  }

  /** Files that match a Drive query of drive.ts: `appProperties has {…} and trashed=false`. */
  function search(q: string): FakeDriveFile[] {
    const wanted = /appProperties has \{ key='(\w+)' and value='(\w+)' \}/.exec(q)
    return [
      ...files.values(),
    ].filter(file => !file.trashed && (!wanted || file.appProperties[wanted[1]!] === wanted[2]))
  }

  async function handle(request: FakeRequest): Promise<FakeResponse> {
    const url = new URL(request.url, 'https://soldo.test')
    const { method } = request
    const path = url.pathname
    log.push(`${method} ${path}`)

    if (path === '/api/google/config')
      return json({ configured: true })
    if (path === '/api/google/token') {
      tokens++
      return json({ accessToken: `token-${tokens}`, expiresIn: 3600 })
    }
    if (path === '/api/google/disconnect')
      return { status: 204 }

    const next = queued.shift()
    if (next)
      return next
    if (!request.authorization?.startsWith('Bearer token-')) {
      return json({
        error: { code: 401 },
      }, 401)
    }

    if (path === '/drive/v3/about') {
      return json({
        user: { emailAddress: 'anna@example.com' },
      })
    }

    if (path === '/drive/v3/files' && method === 'GET') {
      const pageSize = Number(url.searchParams.get('pageSize') ?? '100')
      const start = Number(url.searchParams.get('pageToken') ?? '0')
      const found = search(url.searchParams.get('q') ?? '')
      return json({
        files: found.slice(start, start + pageSize).map(resource),
        ...(start + pageSize < found.length
          ? {
              nextPageToken: String(start + pageSize),
            }
          : {}),
      })
    }
    if (path === '/drive/v3/files' && method === 'POST') {
      const metadata = JSON.parse(new TextDecoder().decode(request.body)) as Record<string, unknown>
      return json(resource(add(metadata, new Uint8Array())))
    }
    if (path === '/upload/drive/v3/files' && method === 'POST') {
      const { metadata, bytes } = parseMultipart(request.contentType ?? '', request.body ?? new Uint8Array())
      return json(resource(add(metadata, bytes)))
    }

    const uploadId = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(path)?.[1]
    if (uploadId && method === 'PATCH') {
      const file = files.get(uploadId)
      if (!file || file.trashed) {
        return json({
          error: { code: 404 },
        }, 404)
      }
      const { metadata, bytes } = parseMultipart(request.contentType ?? '', request.body ?? new Uint8Array())
      file.name = String(metadata.name ?? file.name)
      // As Drive does: the properties sent are merged into those of the file.
      file.appProperties = {
        ...file.appProperties,
        ...metadata.appProperties as Record<string, string> | undefined,
      }
      file.bytes = bytes
      return json(resource(file))
    }

    const fileId = /^\/drive\/v3\/files\/([^/]+)$/.exec(path)?.[1]
    const file = fileId
      ? files.get(fileId)
      : undefined
    if (fileId && (!file || file.trashed)) {
      return json({
        error: { code: 404 },
      }, 404)
    }
    if (file && method === 'GET' && url.searchParams.get('alt') === 'media')
      return { status: 200, contentType: 'application/octet-stream', body: file.bytes }
    if (file && method === 'PATCH') {
      const patch = JSON.parse(new TextDecoder().decode(request.body)) as { trashed?: boolean }
      file.trashed = patch.trashed ?? file.trashed
      return json(resource(file))
    }
    return json({
      error: { code: 404 },
    }, 404)
  }

  return {
    handle,
    files,
    /** Every request, as `METHOD /path`. */
    log,
    /** Answers the next Drive request with `response`, whatever it is. */
    queue(response: FakeResponse) {
      queued.push(response)
    },
    /** A Drive error with a reason, as Google returns it. */
    error(status: number, reason: string): FakeResponse {
      return json({
        error: {
          code: status,
          errors: [
            { reason },
          ],
        },
      }, status)
    },
    /** Puts a backup on the Drive, as another device would have. */
    addBackup(metadata: { name: string, appProperties: Record<string, string> }, bytes: Uint8Array<ArrayBuffer>) {
      return add({ ...metadata, mimeType: 'application/gzip' }, bytes)
    },
    /** The backups not in the trash. */
    backups(): FakeDriveFile[] {
      return search('appProperties has { key=\'soldo\' and value=\'backup\' }')
    },
    get tokens() {
      return tokens
    },
  }
}

export type FakeDrive = ReturnType<typeof createFakeDrive>

/** `fetch` answered by the fake Drive, for the unit tests. */
export function fakeDriveFetch(drive: FakeDrive) {
  return async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url
    const headers = new Headers(init.headers)
    let body: Uint8Array | undefined
    if (init.body instanceof Blob)
      body = new Uint8Array(await init.body.arrayBuffer())
    else if (typeof init.body === 'string')
      body = new TextEncoder().encode(init.body)
    const response = await drive.handle({
      method: init.method ?? 'GET',
      url,
      contentType: headers.get('Content-Type') ?? undefined,
      authorization: headers.get('Authorization') ?? undefined,
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
