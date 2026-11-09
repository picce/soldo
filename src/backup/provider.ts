/**
 * A place where the automatic backup goes (docs/specs/backup-google-drive.md): Google Drive
 * today, Dropbox and OneDrive in Phase 5. The backup to a file of Phase 2 is not one: it
 * needs the user's tap to share or download, so the engine cannot write it by itself.
 */

/** What a backup holds, stored next to the file so a list does not download it. */
export interface BackupSummary {
  exportedAt: string
  transactions: number
  categories: number
  accounts: number
  /** SHA-256 of the data, hex: the same data gives the same checksum. */
  checksum: string
  /** The file is encrypted with a passphrase (docs/specs/released/backup-cifrati.md). */
  encrypted?: boolean
}

export interface RemoteBackup extends BackupSummary {
  id: string
  name: string
  /** Local calendar day of the backup, `YYYY-MM-DD`: one file per day. */
  day: string
}

export interface BackupUpload {
  day: string
  /** The backup file, compressed and maybe encrypted (`sealBackup` of pack.ts). */
  bytes: Uint8Array<ArrayBuffer>
  summary: BackupSummary
  /** Today's file, to update instead of adding one; a new file if it is gone. */
  replaceId?: string
}

export interface BackupProvider {
  /** Who is signed in (an email address), for the Settings. */
  account: () => Promise<string | undefined>
  /** The backups, newest first. */
  list: () => Promise<RemoteBackup[]>
  upload: (upload: BackupUpload) => Promise<RemoteBackup>
  download: (id: string) => Promise<Uint8Array<ArrayBuffer>>
  remove: (id: string) => Promise<void>
}

/**
 * Why a backup did not go: no network; the permission was revoked or expired (sign in
 * again); the storage is full; the service did not answer (try again later).
 */
export type BackupErrorCode = 'offline' | 'auth' | 'quota' | 'unavailable'

export class BackupProviderError extends Error {
  constructor(readonly code: BackupErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'BackupProviderError'
  }
}

/** The code of any error thrown while backing up: unknown errors count as 'unavailable'. */
export function errorCode(error: unknown): BackupErrorCode {
  return error instanceof BackupProviderError
    ? error.code
    : 'unavailable'
}

/** One file per day: compressed JSON, or encrypted (docs/specs/released/backup-cifrati.md). */
export function backupName(day: string, encrypted = false): string {
  return encrypted
    ? `soldo-backup-${day}.soldo`
    : `soldo-backup-${day}.json.gz`
}
