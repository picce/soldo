import type { OAuthService } from './oauth'
import { handleOAuth, refresh } from './oauth'

/**
 * Dropbox sign-in for the backup (docs/specs/backup-dropbox-onedrive.md, "Worker"): the
 * flow of oauth.ts with Dropbox's endpoints. The Dropbox app has "App folder" access, so
 * Soldo sees only `Applicazioni/Soldo`.
 */

/** Secrets set with `wrangler secret put` (docs/dropbox-onedrive.md); in development `.dev.vars`. */
export interface DropboxSecrets {
  DROPBOX_CLIENT_ID?: string
  DROPBOX_CLIENT_SECRET?: string
  COOKIE_SECRET?: string
}

export const DROPBOX_SCOPES = ['files.content.write', 'files.content.read', 'account_info.read']
const REVOKE_URL = 'https://api.dropboxapi.com/2/auth/token/revoke'

export const dropbox: OAuthService = {
  id: 'dropbox',
  sessionCookie: '__Secure-soldo-dropbox',
  authUrl: 'https://www.dropbox.com/oauth2/authorize',
  tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
  scope: DROPBOX_SCOPES.join(' '),
  // A refresh token, not only a 4-hour access token.
  authParams: { token_access_type: 'offline' },
  credentials(env) {
    const { DROPBOX_CLIENT_ID, DROPBOX_CLIENT_SECRET, COOKIE_SECRET } = env as DropboxSecrets
    return DROPBOX_CLIENT_ID && DROPBOX_CLIENT_SECRET && COOKIE_SECRET
      ? { clientId: DROPBOX_CLIENT_ID, clientSecret: DROPBOX_CLIENT_SECRET, cookieSecret: COOKIE_SECRET }
      : undefined
  },
  granted(body) {
    const granted = body.scope?.split(' ') ?? []
    return DROPBOX_SCOPES.every(scope => granted.includes(scope))
  },
  // Dropbox revokes with an access token: get one, then revoke it with its refresh token.
  async revoke(refreshToken, credentials) {
    const { body } = await refresh(dropbox, refreshToken, credentials)
    if (body.access_token) {
      await fetch(REVOKE_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${body.access_token}` },
      })
    }
  },
}

/** Answers `/api/dropbox/*`; undefined for any other path. */
export function handleDropbox(request: Request, env: DropboxSecrets): Promise<Response | undefined> {
  return handleOAuth(dropbox, request, env as Record<string, unknown>)
}
