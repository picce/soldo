import type { Ref } from 'vue'
import { readonly, ref } from 'vue'
import { BackupProviderError } from '../provider'

/**
 * Sign-in to Google Drive through the Worker (worker/google.ts): the Worker keeps the
 * refresh token in a cookie the page cannot read and hands out access tokens, which stay
 * in memory here until a minute before they expire.
 */

const API = '/api/google'
const AVAILABLE_KEY = 'soldo.drive-available'
/** An access token is renewed when less than this is left. */
const EXPIRY_MARGIN = 60_000

/** Leaves the app for Google's consent screen; Google brings the user back to `returnPath`. */
export function connectGoogle(returnPath: string): void {
  window.location.assign(`${API}/connect?return=${encodeURIComponent(returnPath)}`)
}

let cached: { token: string, expiresAt: number } | undefined

/** A valid access token; `fresh` asks for a new one (after a 401 from Drive). */
export async function accessToken(fresh = false): Promise<string> {
  if (!fresh && cached && cached.expiresAt - EXPIRY_MARGIN > Date.now())
    return cached.token
  cached = undefined
  let response: Response
  try {
    response = await fetch(`${API}/token`, { method: 'POST' })
  }
  catch {
    throw new BackupProviderError('offline')
  }
  if (response.status === 401)
    throw new BackupProviderError('auth')
  if (!response.ok)
    throw new BackupProviderError('unavailable')
  const body = await response.json() as { accessToken: string, expiresIn: number }
  cached = { token: body.accessToken, expiresAt: Date.now() + body.expiresIn * 1000 }
  return cached.token
}

/** Revokes the permission and forgets the sign-in; without network only this device forgets. */
export async function disconnectGoogle(): Promise<void> {
  cached = undefined
  await fetch(`${API}/disconnect`, { method: 'POST' }).catch(() => undefined)
}

function readAvailable(): boolean {
  try {
    return localStorage.getItem(AVAILABLE_KEY) === '1'
  }
  catch {
    return false
  }
}

const available = ref(readAvailable())
let asked = false

/**
 * Whether this site can back up to Drive (the Worker has Google's credentials). Asked once
 * per session; the last answer is remembered for when the network is missing.
 */
export function useDriveAvailable(): Readonly<Ref<boolean>> {
  if (!asked) {
    asked = true
    void fetch(`${API}/config`)
      .then(response => response.ok
        ? response.json() as Promise<{ configured?: boolean }>
        : undefined)
      .then((body) => {
        if (!body)
          return
        available.value = body.configured === true
        localStorage.setItem(AVAILABLE_KEY, available.value
          ? '1'
          : '0')
      })
      .catch(() => undefined)
  }
  return readonly(available)
}

/** Forgets the cached token and availability; tests only. */
export function resetGoogleAuth(): void {
  cached = undefined
  asked = false
  available.value = readAvailable()
}
