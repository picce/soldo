import type { Ref } from 'vue'
import { readonly, ref } from 'vue'
import { BackupProviderError } from './provider'

/**
 * Sign-in to a backup service through the Worker (worker/oauth.ts): the Worker keeps the
 * refresh token in a cookie the page cannot read and hands out access tokens, which stay
 * in memory here until a minute before they expire. One per service: Google Drive, Dropbox,
 * OneDrive (docs/specs/backup-dropbox-onedrive.md).
 */

export type ServiceId = 'google' | 'dropbox' | 'onedrive'

/** An access token is renewed when less than this is left. */
const EXPIRY_MARGIN = 60_000

export interface ServiceAuth {
  /** Leaves the app for the consent screen; the service brings the user back to `returnPath`. */
  connect: (returnPath: string) => void
  /** A valid access token; `fresh` asks for a new one (after a 401 from the service). */
  accessToken: (fresh?: boolean) => Promise<string>
  /** Revokes the permission and forgets the sign-in; without network only this device forgets. */
  disconnect: () => Promise<void>
  /**
   * Whether this site can back up there (the Worker has the service's credentials). Asked
   * once per session; the last answer is remembered for when the network is missing.
   */
  useAvailable: () => Readonly<Ref<boolean>>
  /** Forgets the cached token and availability; tests only. */
  reset: () => void
}

export function serviceAuth(id: ServiceId): ServiceAuth {
  const api = `/api/${id}`
  // Google kept its key from before Dropbox and OneDrive.
  const availableKey = id === 'google'
    ? 'soldo.drive-available'
    : `soldo.${id}-available`
  let cached: { token: string, expiresAt: number } | undefined

  function readAvailable(): boolean {
    try {
      return localStorage.getItem(availableKey) === '1'
    }
    catch {
      return false
    }
  }

  const available = ref(readAvailable())
  let asked = false

  return {
    connect(returnPath) {
      window.location.assign(`${api}/connect?return=${encodeURIComponent(returnPath)}`)
    },

    async accessToken(fresh = false) {
      if (!fresh && cached && cached.expiresAt - EXPIRY_MARGIN > Date.now())
        return cached.token
      cached = undefined
      let response: Response
      try {
        response = await fetch(`${api}/token`, { method: 'POST' })
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
    },

    async disconnect() {
      cached = undefined
      await fetch(`${api}/disconnect`, { method: 'POST' }).catch(() => undefined)
    },

    useAvailable() {
      if (!asked) {
        asked = true
        void fetch(`${api}/config`)
          .then(response => response.ok
            ? response.json() as Promise<{ configured?: boolean }>
            : undefined)
          .then((body) => {
            if (!body)
              return
            available.value = body.configured === true
            localStorage.setItem(availableKey, available.value
              ? '1'
              : '0')
          })
          .catch(() => undefined)
      }
      return readonly(available)
    },

    reset() {
      cached = undefined
      asked = false
      available.value = readAvailable()
    },
  }
}
