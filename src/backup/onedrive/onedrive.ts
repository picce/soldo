import type { FolderFile, FolderStore } from '../folder'
import { authorizedFetch } from '../authorized'
import { folderProvider } from '../folder'
import { BackupProviderError } from '../provider'
import { serviceAuths } from '../services'

/**
 * Backups on OneDrive (docs/specs/backup-dropbox-onedrive.md), with Microsoft Graph called
 * from the browser. The scope `Files.ReadWrite.AppFolder` gives Soldo `App/Soldo` only,
 * the "approot" of the drive.
 */

const onedriveAuth = serviceAuths.onedrive

const GRAPH = 'https://graph.microsoft.com/v1.0'
const ROOT = `${GRAPH}/me/drive/special/approot`

function item(name: string): string {
  return `${ROOT}:/${encodeURIComponent(name)}`
}

interface GraphError {
  error?: { code?: string }
}

async function failure(response: Response): Promise<BackupProviderError> {
  const body = await response.json().catch(() => ({})) as GraphError
  const code = body.error?.code ?? ''
  if (response.status === 507 || code === 'quotaLimitReached')
    return new BackupProviderError('quota')
  if (response.status === 403)
    return new BackupProviderError('auth')
  return new BackupProviderError('unavailable', `OneDrive answered ${response.status}`)
}

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const response = await authorizedFetch(onedriveAuth, url, init)
  if (!response.ok)
    throw await failure(response)
  return response
}

interface Children {
  'value': { name: string, lastModifiedDateTime?: string, file?: object }[]
  '@odata.nextLink'?: string
}

export const onedriveStore: FolderStore = {
  async account() {
    const body = await (await call(`${GRAPH}/me?$select=mail,userPrincipalName`)).json() as { mail?: string | null, userPrincipalName?: string }
    return body.mail ?? body.userPrincipalName
  },

  async list() {
    const files: FolderFile[] = []
    let next: string | undefined = `${ROOT}/children?$select=name,lastModifiedDateTime,file&$top=200`
    while (next) {
      const page = await (await call(next)).json() as Children
      for (const entry of page.value) {
        if (entry.file)
          files.push({ name: entry.name, modifiedAt: entry.lastModifiedDateTime ?? new Date(0).toISOString() })
      }
      next = page['@odata.nextLink']
    }
    return files
  },

  async read(name) {
    // The download goes to a short-lived address of its own, which needs no token.
    const response = await authorizedFetch(onedriveAuth, `${item(name)}?$select=id,@microsoft.graph.downloadUrl`)
    if (response.status === 404)
      return null
    if (!response.ok)
      throw await failure(response)
    const url = (await response.json() as Record<string, string>)['@microsoft.graph.downloadUrl']
    if (!url)
      throw new BackupProviderError('unavailable', 'OneDrive gave no download address')
    let download: Response
    try {
      download = await fetch(url)
    }
    catch {
      throw new BackupProviderError('unavailable')
    }
    if (!download.ok)
      throw new BackupProviderError('unavailable', `OneDrive answered ${download.status}`)
    return new Uint8Array(await download.arrayBuffer())
  },

  async write(name, bytes, type) {
    // A simple upload: backups stay far below the 250 MB it takes.
    await call(`${item(name)}:/content?@microsoft.graph.conflictBehavior=replace`, {
      method: 'PUT',
      headers: { 'Content-Type': type },
      body: bytes,
    })
  },

  async remove(name) {
    const response = await authorizedFetch(onedriveAuth, item(name), { method: 'DELETE' })
    if (!response.ok && response.status !== 404)
      throw await failure(response)
  },
}

export const onedrive = folderProvider(onedriveStore)
