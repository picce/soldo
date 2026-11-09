import { serviceAuth } from '../oauth'

/**
 * Sign-in to Google Drive through the Worker (worker/google.ts), on the shared flow of
 * ../oauth.ts.
 */
export const googleAuth = serviceAuth('google')

export const connectGoogle = googleAuth.connect
export const accessToken = googleAuth.accessToken
export const disconnectGoogle = googleAuth.disconnect
export const useDriveAvailable = googleAuth.useAvailable
export const resetGoogleAuth = googleAuth.reset
