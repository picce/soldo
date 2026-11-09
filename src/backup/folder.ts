import type { BackupProvider, BackupSummary, RemoteBackup } from './provider'
import { backupName, BackupProviderError } from './provider'

/**
 * Backups in a plain folder of a cloud service (docs/specs/backup-dropbox-onedrive.md):
 * Dropbox and OneDrive give Soldo a folder of its own, but no properties on the files as
 * Google Drive does. The summary of each backup (day, date, counts, checksum) lives in an
 * index next to the files, so the list shows without downloading them. A file missing from
 * the index still shows, with the day taken from its name; an entry without its file is
 * ignored. Files are named by day and addressed by name.
 */

export interface FolderFile {
  name: string
  /** When the service last wrote the file, ISO 8601. */
  modifiedAt: string
}

/** What a service has to offer: a folder that only Soldo writes in. */
export interface FolderStore {
  account: () => Promise<string | undefined>
  list: () => Promise<FolderFile[]>
  /** `null` when the file is not there. */
  read: (name: string) => Promise<Uint8Array<ArrayBuffer> | null>
  /** Creates the file, or replaces it. */
  write: (name: string, bytes: Uint8Array<ArrayBuffer>, type: string) => Promise<void>
  /** Nothing happens when the file is already gone. */
  remove: (name: string) => Promise<void>
}

export const INDEX_NAME = 'soldo-backups.json'
const BACKUP_NAME = /^soldo-backup-(\d{4}-\d{2}-\d{2})\.(?:json\.gz|soldo)$/

type Index = Record<string, BackupSummary & { day: string }>

async function readIndex(store: FolderStore): Promise<Index> {
  const bytes = await store.read(INDEX_NAME)
  if (!bytes)
    return {}
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { backups?: Index }
    return typeof parsed.backups === 'object' && parsed.backups !== null
      ? parsed.backups
      : {}
  }
  catch {
    // A broken index is rebuilt by the next uploads.
    return {}
  }
}

function writeIndex(store: FolderStore, index: Index): Promise<void> {
  const bytes = new TextEncoder().encode(JSON.stringify({ version: 1, backups: index }))
  return store.write(INDEX_NAME, bytes, 'application/json')
}

function toRemote(name: string, day: string, summary: BackupSummary): RemoteBackup {
  return { ...summary, id: name, name, day }
}

export function folderProvider(store: FolderStore): BackupProvider {
  return {
    account: () => store.account(),

    async list() {
      const [files, index] = await Promise.all([
        store.list(),
        readIndex(store),
      ])
      const backups: RemoteBackup[] = []
      for (const file of files) {
        const day = BACKUP_NAME.exec(file.name)?.[1]
        if (!day)
          continue
        const summary = index[file.name] ?? {
          exportedAt: file.modifiedAt,
          transactions: 0,
          categories: 0,
          accounts: 0,
          // Unknown: the download is not checked.
          checksum: '',
          encrypted: file.name.endsWith('.soldo'),
        }
        backups.push(toRemote(file.name, day, summary))
      }
      return backups.sort((a, b) => b.exportedAt.localeCompare(a.exportedAt))
    },

    async upload({ day, bytes, summary, replaceId }) {
      const encrypted = summary.encrypted === true
      const name = backupName(day, encrypted)
      await store.write(name, bytes, encrypted
        ? 'application/octet-stream'
        : 'application/gzip')
      const index = await readIndex(store)
      index[name] = { ...summary, encrypted, day }
      // Today's file under its other name (the encryption was turned on or off): replaced.
      if (replaceId && replaceId !== name) {
        await store.remove(replaceId)
        delete index[replaceId]
      }
      await writeIndex(store, index)
      return toRemote(name, day, { ...summary, encrypted })
    },

    async download(id) {
      const bytes = await store.read(id)
      if (!bytes)
        throw new BackupProviderError('unavailable', `${id} is gone`)
      return bytes
    },

    async remove(id) {
      await store.remove(id)
      const index = await readIndex(store)
      if (id in index) {
        delete index[id]
        await writeIndex(store, index)
      }
    },
  }
}
