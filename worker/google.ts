import type { OAuthService } from './oauth'
import { handleOAuth, postForm } from './oauth'

/**
 * Google Drive sign-in for the backup (docs/specs/backup-google-drive.md, "Worker"): the
 * flow of oauth.ts with Google's endpoints and the `drive.file` scope.
 */

/** Secrets set with `wrangler secret put` (docs/google-drive.md); in development `.dev.vars`. */
export interface GoogleSecrets {
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  COOKIE_SECRET?: string
}

const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
/** Only the files Soldo creates: a non-sensitive scope. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
/** The refresh token: sent only by the app's own requests. */
export const SESSION_COOKIE = '__Secure-soldo-google'
export { FLOW_COOKIE, safeReturnPath } from './oauth'

export const google: OAuthService = {
  id: 'google',
  sessionCookie: SESSION_COOKIE,
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scope: DRIVE_SCOPE,
  // A refresh token every time, also when the user had already agreed.
  authParams: { access_type: 'offline', prompt: 'consent' },
  credentials(env) {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, COOKIE_SECRET } = env as GoogleSecrets
    return GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && COOKIE_SECRET
      ? { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, cookieSecret: COOKIE_SECRET }
      : undefined
  },
  // Google lets the user untick Drive on the consent screen: without it there is no backup.
  granted: body => Boolean(body.scope?.split(' ').includes(DRIVE_SCOPE)),
  async revoke(refreshToken) {
    await postForm(REVOKE_URL, { token: refreshToken })
  },
}

/** Answers `/api/google/*`; undefined for any other path. */
export function handleGoogle(request: Request, env: GoogleSecrets): Promise<Response | undefined> {
  return handleOAuth(google, request, env as Record<string, unknown>)
}
