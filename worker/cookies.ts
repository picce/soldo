/**
 * Encrypted cookies (docs/specs/backup-google-drive.md, "Worker"): the value is sealed with
 * AES-GCM, so only the Worker reads it, and the cookie name is authenticated with it, so a
 * value cannot be moved from one cookie to another.
 */

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes)
    binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4))
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

/** Random bytes as base64url: OAuth `state` and the PKCE `code_verifier`. */
export function randomToken(bytes = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)))
}

export async function sha256(text: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))
}

const keys = new Map<string, Promise<CryptoKey>>()

/** AES-256 key from any secret string, derived once per Worker instance. */
function keyFor(secret: string): Promise<CryptoKey> {
  let key = keys.get(secret)
  if (!key) {
    key = sha256(secret).then(digest => crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']))
    keys.set(secret, key)
  }
  return key
}

/** Encrypts a JSON value for the cookie `name`. */
export async function seal(secret: string, name: string, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const sealed = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: encoder.encode(name),
    },
    await keyFor(secret),
    encoder.encode(JSON.stringify(value)),
  )
  const out = new Uint8Array(iv.length + sealed.byteLength)
  out.set(iv)
  out.set(new Uint8Array(sealed), iv.length)
  return toBase64Url(out)
}

/** Decrypts a value sealed for the cookie `name`; undefined if it was altered or is not ours. */
export async function unseal<T>(secret: string, name: string, sealed: string): Promise<T | undefined> {
  try {
    const bytes = fromBase64Url(sealed)
    const plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: bytes.slice(0, 12),
        additionalData: encoder.encode(name),
      },
      await keyFor(secret),
      bytes.slice(12),
    )
    return JSON.parse(decoder.decode(plain)) as T
  }
  catch {
    return undefined
  }
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('Cookie')
  if (!header)
    return undefined
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index > 0 && part.slice(0, index).trim() === name)
      return part.slice(index + 1).trim()
  }
  return undefined
}

export interface CookieOptions {
  path: string
  maxAge: number
  sameSite: 'Strict' | 'Lax'
}

/** A `Set-Cookie` value: always HttpOnly and Secure (localhost counts as secure in browsers). */
export function serializeCookie(name: string, value: string, options: CookieOptions): string {
  return [
    `${name}=${value}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    'HttpOnly',
    'Secure',
    `SameSite=${options.sameSite}`,
  ].join('; ')
}

export function clearCookie(name: string, options: Omit<CookieOptions, 'maxAge'>): string {
  return serializeCookie(name, '', { ...options, maxAge: 0 })
}
