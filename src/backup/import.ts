import type { BackupKey } from './crypto'
import type { BackupFile } from './format'
import type { Account } from '@/db/schema'
import { db } from '@/db/database'
import { defaultPaymentMethods, firstActiveAccount } from '@/db/payment-defaults'
import { generateDueOccurrences } from '@/db/repositories/recurrences'
import { SCHEMA_VERSION } from '@/db/schema'
import { today } from '@/domain/dates'
import { decryptBytes, isEncrypted } from './crypto'
import { adoptEncryption } from './encryption'
import { backupFileSchema } from './format'
import { gunzip, isGzip, sha256Hex } from './pack'
import { BACKUP_FORMAT } from './version'

/** Larger files are not Soldo backups (100,000 transactions take about 40 MB). */
const MAX_FILE_BYTES = 100 * 1024 * 1024

/**
 * Why a file cannot be restored; the data on the device is untouched in every case. An
 * encrypted file is not an error: it is `locked` until the passphrase opens it.
 */
export type BackupError = 'notSoldo' | 'newerFormat' | 'invalid' | 'wrongPassphrase'

/** An encrypted backup, waiting for the passphrase (docs/specs/released/backup-cifrati.md). */
export interface LockedBackup {
  bytes: Uint8Array<ArrayBuffer>
  fileName: string
  /** Kept by Drive next to the file: checked once the file is open. */
  checksum?: string
}

/** What the confirmation shows before replacing the data. */
export interface BackupPreview {
  fileName: string
  exportedAt: string
  transactions: number
  categories: number
  accounts: number
}

export type BackupReading
  = | {
    ok: true
    backup: BackupFile
    preview: BackupPreview
    /** The key that opened an encrypted file: the device keeps it after the restore. */
    key?: BackupKey
  }
  | { ok: false, error: BackupError }
  | { ok: false, error: 'locked', locked: LockedBackup }

/** A backup that can be restored now, or once the passphrase opens it. */
export type OpenableReading = Extract<BackupReading, { ok: true } | { error: 'locked' }>

function alive<T extends { deletedAt: string | null }>(rows: T[]): number {
  return rows.filter(row => row.deletedAt === null).length
}

const NOT_SOLDO: BackupReading = { ok: false, error: 'notSoldo' }

/**
 * Format 1 had no payment methods: the file gets the default ones, on its first account, as the
 * database does when it upgrades. Format 2 needs nothing: format 3 only adds optional fields (the
 * end of a budget, the payment method of a recurrence); format 4 adds the import rules and
 * presets, empty in an older file (format.ts). A file with broken data fails the check that
 * follows.
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
 * An encrypted file comes back `locked`: `unlockBackup` opens it with the passphrase.
 */
export async function readBackupBytes(bytes: Uint8Array<ArrayBuffer>, fileName: string, checksum?: string): Promise<BackupReading> {
  if (isEncrypted(bytes)) {
    return {
      ok: false,
      error: 'locked',
      locked: { bytes, fileName, checksum },
    }
  }
  return readPlain(bytes, fileName, checksum)
}

/** Opens an encrypted backup with the passphrase, then reads it as any other. */
export async function unlockBackup(locked: LockedBackup, passphrase: string): Promise<BackupReading> {
  const opened = await decryptBytes(locked.bytes, passphrase)
  if (!opened)
    return { ok: false, error: 'wrongPassphrase' }
  const reading = await readPlain(opened.bytes, locked.fileName, locked.checksum)
  return reading.ok
    ? { ...reading, key: opened.key }
    : reading
}

async function readPlain(bytes: Uint8Array<ArrayBuffer>, fileName: string, checksum?: string): Promise<BackupReading> {
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

  const parsed = backupFileSchema.safeParse({
    ...(format === 1
      ? upgradeFormat1(raw)
      : raw),
    format: BACKUP_FORMAT,
  })
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
 * device is now the data of that file. With the `key` of an encrypted backup the device
 * goes on encrypting with it, so the next backups do not go out in clear.
 */
export async function restoreBackup(backup: BackupFile, key?: BackupKey): Promise<void> {
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
      db.importRules.bulkAdd(data.importRules),
      db.importPresets.bulkAdd(data.importPresets),
      db.settings.bulkAdd(data.settings),
      db.meta.bulkAdd(data.meta),
    ])
    await db.meta.bulkPut([
      { key: 'lastExportAt', value: backup.exportedAt },
      { key: 'schemaVersion', value: SCHEMA_VERSION },
    ])
  })
  if (key)
    await adoptEncryption(key)
  // The series of the file go on from where they were: what came due since is added now.
  await generateDueOccurrences(today())
}
