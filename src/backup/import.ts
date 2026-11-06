import type { BackupFile } from './format'
import type { Account } from '@/db/schema'
import { db } from '@/db/database'
import { defaultPaymentMethods, firstActiveAccount } from '@/db/payment-defaults'
import { SCHEMA_VERSION } from '@/db/schema'
import { backupFileSchema } from './format'
import { gunzip, isGzip, sha256Hex } from './pack'
import { BACKUP_FORMAT } from './version'

/** Larger files are not Soldo backups (100,000 transactions take about 40 MB). */
const MAX_FILE_BYTES = 100 * 1024 * 1024

/** Why a file cannot be restored; the data on the device is untouched in every case. */
export type BackupError = 'notSoldo' | 'newerFormat' | 'invalid'

/** What the confirmation shows before replacing the data. */
export interface BackupPreview {
  fileName: string
  exportedAt: string
  transactions: number
  categories: number
  accounts: number
}

export type BackupReading
  = | { ok: true, backup: BackupFile, preview: BackupPreview }
    | { ok: false, error: BackupError }

function alive<T extends { deletedAt: string | null }>(rows: T[]): number {
  return rows.filter(row => row.deletedAt === null).length
}

const NOT_SOLDO: BackupReading = { ok: false, error: 'notSoldo' }

/**
 * Format 1 had no payment methods: the file gets the default ones, on its first account, as the
 * database does when it upgrades. A file with broken data fails the check that follows.
 */
function upgradeFormat1(raw: object): object {
  const data = (raw as { data?: { accounts?: unknown } }).data
  if (typeof data !== 'object' || data === null || !Array.isArray(data.accounts))
    return raw
  const account = firstActiveAccount(data.accounts as Account[])
  return {
    ...raw,
    format: BACKUP_FORMAT,
    data: {
      ...data,
      paymentMethods: account
        ? defaultPaymentMethods(account.id)
        : [],
    },
  }
}

/** Reads and checks a backup file, plain JSON or compressed, without touching the database. */
export async function readBackup(file: File): Promise<BackupReading> {
  if (file.size > MAX_FILE_BYTES)
    return NOT_SOLDO
  return readBackupBytes(new Uint8Array(await file.arrayBuffer()), file.name)
}

/**
 * Reads and checks the bytes of a backup: a file, or a download from Drive. With
 * `checksum` (Drive keeps it next to the file) data that changed on the way is refused.
 */
export async function readBackupBytes(bytes: Uint8Array<ArrayBuffer>, fileName: string, checksum?: string): Promise<BackupReading> {
  let raw: unknown
  try {
    raw = JSON.parse(isGzip(bytes)
      ? await gunzip(bytes)
      : new TextDecoder().decode(bytes))
  }
  catch {
    return NOT_SOLDO
  }
  if (typeof raw !== 'object' || raw === null || (raw as { app?: unknown }).app !== 'soldo')
    return NOT_SOLDO
  const format = (raw as { format?: unknown }).format
  if (typeof format === 'number' && format > BACKUP_FORMAT)
    return { ok: false, error: 'newerFormat' }
  // Before Zod, which rewrites the keys in its own order: the checksum is of the text.
  if (checksum && await sha256Hex(JSON.stringify((raw as { data?: unknown }).data)) !== checksum)
    return { ok: false, error: 'invalid' }

  const parsed = backupFileSchema.safeParse(format === 1
    ? upgradeFormat1(raw)
    : raw)
  if (!parsed.success)
    return { ok: false, error: 'invalid' }
  const backup = parsed.data
  return {
    ok: true,
    backup,
    preview: {
      fileName,
      exportedAt: backup.exportedAt,
      transactions: alive(backup.data.transactions),
      categories: alive(backup.data.categories),
      accounts: alive(backup.data.accounts),
    },
  }
}

/**
 * Replaces every table with the backup, in one transaction: either all of it is restored
 * or nothing changes. The backup's date becomes «Ultimo backup», since the data on the
 * device is now the data of that file.
 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  const { data } = backup
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map(table => table.clear()))
    await Promise.all([
      db.accounts.bulkAdd(data.accounts),
      db.paymentMethods.bulkAdd(data.paymentMethods),
      db.categories.bulkAdd(data.categories),
      db.transactions.bulkAdd(data.transactions),
      db.budgets.bulkAdd(data.budgets),
      db.recurrences.bulkAdd(data.recurrences),
      db.settings.bulkAdd(data.settings),
      db.meta.bulkAdd(data.meta),
    ])
    await db.meta.bulkPut([
      { key: 'lastExportAt', value: backup.exportedAt },
      { key: 'schemaVersion', value: SCHEMA_VERSION },
    ])
  })
}
