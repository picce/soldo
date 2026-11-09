import type { FolderFile, FolderStore } from '../folder'
import { authorizedFetch } from '../authorized'
import { folderProvider } from '../folder'
import { BackupProviderError } from '../provider'
import { serviceAuths } from '../services'

/**
 * Backups on Dropbox (docs/specs/backup-dropbox-onedrive.md), with the Dropbox API v2
 * called from the browser. The app has "App folder" access: the root here is
 * `Applicazioni/Soldo` of the user's Dropbox.
 */

const dropboxAuth = serviceAuths.dropbox

const API = 'https://api.dropboxapi.com/2'
const CONTENT = 'https://content.dropboxapi.com/2'

interface DropboxError {
  error_summary?: string
}

async function failure(response: Response): Promise<BackupProviderError> {
  const body = await response.json().catch(() => ({})) as DropboxError
  const summary = body.error_summary ?? ''
  if (summary.includes('insufficient_space'))
    return new BackupProviderError('quota')
  if (response.status === 403 || summary.includes('missing_scope'))
    return new BackupProviderError('auth')
  return new BackupProviderError('unavailable', `Dropbox answered ${response.status}`)
}

/** A 409 that says the file is not there. */
async function isMissing(response: Response): Promise<boolean> {
  if (response.status !== 409)
    return false
  const body = await response.clone().json().catch(() => ({})) as DropboxError
  return Boolean(body.error_summary?.includes('not_found'))
}

/** An RPC call: JSON in, JSON out. */
async function rpc<T>(endpoint: string, args: unknown): Promise<T> {
  const response = await authorizedFetch(dropboxAuth, `${API}/${endpoint}`, args === null
    ? { method: 'POST' }
    : {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      })
  if (!response.ok)
    throw await failure(response)
  return response.json() as Promise<T>
}

/** Arguments of a content call go in a header, which must stay ASCII. */
function apiArg(value: object): string {
  return JSON.stringify(value).split('').map(char => char.charCodeAt(0) < 0x7F
    ? char
    : `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`).join('')
}

interface ListResult {
  entries: { '.tag': string, 'name': string, 'server_modified'?: string }[]
  cursor: string
  has_more: boolean
}

export const dropboxStore: FolderStore = {
  async account() {
    const body = await rpc<{ email?: string }>('users/get_current_account', null)
    return body.email
  },

  async list() {
    const files: FolderFile[] = []
    let page = await rpc<ListResult>('files/list_folder', { path: '' })
    for (;;) {
      for (const entry of page.entries) {
        if (entry['.tag'] === 'file')
          files.push({ name: entry.name, modifiedAt: entry.server_modified ?? new Date(0).toISOString() })
      }
      if (!page.has_more)
        return files
      page = await rpc<ListResult>('files/list_folder/continue', { cursor: page.cursor })
    }
  },

  async read(name) {
    const response = await authorizedFetch(dropboxAuth, `${CONTENT}/files/download`, {
      method: 'POST',
      headers: {
        'Dropbox-API-Arg': apiArg({ path: `/${name}` }),
      },
    })
    if (await isMissing(response))
      return null
    if (!response.ok)
      throw await failure(response)
    return new Uint8Array(await response.arrayBuffer())
  },

  async write(name, bytes) {
    const response = await authorizedFetch(dropboxAuth, `${CONTENT}/files/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': apiArg({ path: `/${name}`, mode: 'overwrite', mute: true }),
      },
      body: bytes,
    })
    if (!response.ok)
      throw await failure(response)
  },

  async remove(name) {
    const response = await authorizedFetch(dropboxAuth, `${API}/files/delete_v2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: `/${name}` }),
    })
    if (!response.ok && !await isMissing(response))
      throw await failure(response)
  },
}

export const dropbox = folderProvider(dropboxStore)
