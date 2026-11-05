import type { BackupProvider, BackupUpload, RemoteBackup } from '../provider'
import { BackupProviderError } from '../provider'
import { BACKUP_FORMAT } from '../version'
import { accessToken } from './auth'

/**
 * Backups on Google Drive (docs/specs/backup-google-drive.md), with the Drive API v3 called
 * from the browser. The scope `drive.file` shows Soldo only the files it created, so the
 * folder and the backups are found by their `appProperties`, wherever the user moves them.
 */

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const FILE_FIELDS = 'id,name,appProperties'
const FOLDER_QUERY = 'appProperties has { key=\'soldo\' and value=\'folder\' } and trashed=false'
const BACKUP_QUERY = 'appProperties has { key=\'soldo\' and value=\'backup\' } and trashed=false'
/** 100 backups per page: retention keeps at most 26, so one page is the norm. */
const MAX_PAGES = 10

interface DriveFile {
  id: string
  name: string
  appProperties?: Record<string, string>
}

interface DriveError {
  error?: { errors?: { reason?: string }[] }
}

const QUOTA_REASONS = new Set(['storageQuotaExceeded', 'quotaExceeded'])
const AUTH_REASONS = new Set(['insufficientPermissions', 'insufficientFilePermissions', 'authError'])

async function errorOf(response: Response): Promise<BackupProviderError> {
  const body = await response.json().catch(() => ({})) as DriveError
  const reasons = body.error?.errors?.map(item => item.reason ?? '') ?? []
  if (reasons.some(reason => QUOTA_REASONS.has(reason)))
    return new BackupProviderError('quota')
  if (response.status === 403 && reasons.some(reason => AUTH_REASONS.has(reason)))
    return new BackupProviderError('auth')
  return new BackupProviderError('unavailable', `Drive answered ${response.status}`)
}

/**
 * A Drive request with the access token. A 401 renews the token once; `missing` returns
 * null for a 404 (a file the user deleted) instead of failing.
 */
async function call(url: string, init: RequestInit = {}, options: { missing?: boolean } = {}, renewed = false): Promise<Response | null> {
  const token = await accessToken(renewed)
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
    return call(url, init, options, true)
  }
  if (response.status === 404 && options.missing)
    return null
  if (!response.ok)
    throw await errorOf(response)
  return response
}

async function callJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  return (await call(url, init))!.json() as Promise<T>
}

function query(params: Record<string, string>): string {
  return new URLSearchParams(params).toString()
}

/** The body of a multipart upload: the file's metadata, then its bytes. */
function multipart(metadata: object, bytes: Uint8Array<ArrayBuffer>, type: string): RequestInit {
  const boundary = `soldo-${crypto.randomUUID()}`
  return {
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${type}\r\n\r\n`,
      bytes,
      `\r\n--${boundary}--`,
    ]),
  }
}

function toRemote(file: DriveFile): RemoteBackup | undefined {
  const properties = file.appProperties ?? {}
  const { day, exportedAt, checksum } = properties
  if (!day || !exportedAt || !checksum)
    return undefined
  const count = (key: string) => Number.parseInt(properties[key] ?? '0', 10) || 0
  return {
    id: file.id,
    name: file.name,
    day,
    exportedAt,
    checksum,
    transactions: count('transactions'),
    categories: count('categories'),
    accounts: count('accounts'),
  }
}

export function backupName(day: string): string {
  return `soldo-backup-${day}.json.gz`
}

let folderId: string | undefined

async function folder(): Promise<string> {
  if (folderId)
    return folderId
  const found = await callJson<{ files: DriveFile[] }>(`${API}/files?${query({
    q: FOLDER_QUERY,
    fields: 'files(id)',
    pageSize: '1',
    spaces: 'drive',
  })}`)
  folderId = found.files[0]?.id ?? (await callJson<DriveFile>(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Soldo',
      mimeType: FOLDER_MIME,
      appProperties: { soldo: 'folder' },
    }),
  })).id
  return folderId
}

export const googleDrive: BackupProvider = {
  async account() {
    const about = await callJson<{ user?: { emailAddress?: string } }>(`${API}/about?fields=user(emailAddress)`)
    return about.user?.emailAddress
  },

  async list() {
    const backups: RemoteBackup[] = []
    let pageToken: string | undefined
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await callJson<{ files: DriveFile[], nextPageToken?: string }>(`${API}/files?${query({
        q: BACKUP_QUERY,
        fields: `nextPageToken,files(${FILE_FIELDS})`,
        pageSize: '100',
        spaces: 'drive',
        ...(pageToken
          ? { pageToken }
          : {}),
      })}`)
      for (const file of result.files) {
        const backup = toRemote(file)
        if (backup)
          backups.push(backup)
      }
      pageToken = result.nextPageToken
      if (!pageToken)
        break
    }
    return backups.sort((a, b) => b.exportedAt.localeCompare(a.exportedAt))
  },

  async upload({ day, bytes, summary, replaceId }: BackupUpload) {
    const metadata = {
      name: backupName(day),
      mimeType: 'application/gzip',
      appProperties: {
        soldo: 'backup',
        format: String(BACKUP_FORMAT),
        day,
        exportedAt: summary.exportedAt,
        transactions: String(summary.transactions),
        categories: String(summary.categories),
        accounts: String(summary.accounts),
        checksum: summary.checksum,
      },
    }
    if (replaceId) {
      // Today's file again: new content, same file. Gone (deleted by the user)? A new one.
      const updated = await call(`${UPLOAD_API}/files/${encodeURIComponent(replaceId)}?${query({ uploadType: 'multipart', fields: FILE_FIELDS })}`, {
        method: 'PATCH',
        ...multipart(metadata, bytes, 'application/gzip'),
      }, { missing: true })
      if (updated)
        return toRemote(await updated.json() as DriveFile)!
    }
    const parent = await folder()
    const created = await callJson<DriveFile>(`${UPLOAD_API}/files?${query({ uploadType: 'multipart', fields: FILE_FIELDS })}`, {
      method: 'POST',
      ...multipart({
        ...metadata,
        parents: [parent],
      }, bytes, 'application/gzip'),
    })
    return toRemote(created)!
  },

  async download(id) {
    const response = await call(`${API}/files/${encodeURIComponent(id)}?alt=media`)
    return new Uint8Array(await response!.arrayBuffer())
  },

  async remove(id) {
    // To the trash, not deleted: the user can still recover it for 30 days.
    await call(`${API}/files/${encodeURIComponent(id)}?fields=id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    }, { missing: true })
  },
}

/** Forgets the folder found earlier; tests only. */
export function forgetDriveFolder(): void {
  folderId = undefined
}
