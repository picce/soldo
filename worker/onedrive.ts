import type { OAuthService } from './oauth'
import { handleOAuth } from './oauth'

/**
 * OneDrive sign-in for the backup (docs/specs/backup-dropbox-onedrive.md, "Worker"): the
 * flow of oauth.ts with the Microsoft identity platform, personal and work accounts. The
 * scope `Files.ReadWrite.AppFolder` shows Soldo only `App/Soldo`. Microsoft has no way to
 * revoke one refresh token: disconnecting forgets it.
 */

/** Secrets set with `wrangler secret put` (docs/dropbox-onedrive.md); in development `.dev.vars`. */
export interface OneDriveSecrets {
  ONEDRIVE_CLIENT_ID?: string
  ONEDRIVE_CLIENT_SECRET?: string
  COOKIE_SECRET?: string
}

export const ONEDRIVE_SCOPE = 'Files.ReadWrite.AppFolder'
const AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0'

export const onedrive: OAuthService = {
  id: 'onedrive',
  sessionCookie: '__Secure-soldo-onedrive',
  authUrl: `${AUTHORITY}/authorize`,
  tokenUrl: `${AUTHORITY}/token`,
  scope: `${ONEDRIVE_SCOPE} User.Read offline_access`,
  credentials(env) {
    const { ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET, COOKIE_SECRET } = env as OneDriveSecrets
    return ONEDRIVE_CLIENT_ID && ONEDRIVE_CLIENT_SECRET && COOKIE_SECRET
      ? { clientId: ONEDRIVE_CLIENT_ID, clientSecret: ONEDRIVE_CLIENT_SECRET, cookieSecret: COOKIE_SECRET }
      : undefined
  },
  // Microsoft may answer with the full name of a scope (https://graph.microsoft.com/…).
  granted: body => (body.scope?.split(' ') ?? []).some(scope => scope.toLowerCase().endsWith(ONEDRIVE_SCOPE.toLowerCase())),
}

/** Answers `/api/onedrive/*`; undefined for any other path. */
export function handleOneDrive(request: Request, env: OneDriveSecrets): Promise<Response | undefined> {
  return handleOAuth(onedrive, request, env as Record<string, unknown>)
}
