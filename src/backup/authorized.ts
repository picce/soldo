import type { ServiceAuth } from './oauth'
import { BackupProviderError } from './provider'

/**
 * A request to a service's API with the access token of `auth`. A 401 renews the token
 * once, then means the permission is gone; a failed network is `offline` or `unavailable`.
 * Other answers come back as they are: each service reads its own errors.
 */
export async function authorizedFetch(auth: ServiceAuth, url: string, init: RequestInit = {}, renewed = false): Promise<Response> {
  const token = await auth.accessToken(renewed)
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    })
  }
  catch {
    throw new BackupProviderError(navigator.onLine === false
      ? 'offline'
      : 'unavailable')
  }
  if (response.status === 401) {
    if (renewed)
      throw new BackupProviderError('auth')
    return authorizedFetch(auth, url, init, true)
  }
  return response
}
