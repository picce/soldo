import type { BackupFile } from './format'
import { db } from '@/db/database'
import { backupFileSchema } from './format'
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

/** Reads and checks a backup file, without touching the database. */
export async function readBackup(file: File): Promise<BackupReading> {
  if (file.size > MAX_FILE_BYTES)
    return { ok: false, error: 'notSoldo' }
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  }
  catch {
    return { ok: false, error: 'notSoldo' }
  }
  if (typeof raw !== 'object' || raw === null || (raw as { app?: unknown }).app !== 'soldo')
    return { ok: false, error: 'notSoldo' }
  // Format 1 is the only one so far: older formats would be upgraded here.
  const format = (raw as { format?: unknown }).format
  if (typeof format === 'number' && format > BACKUP_FORMAT)
    return { ok: false, error: 'newerFormat' }

  const parsed = backupFileSchema.safeParse(raw)
  if (!parsed.success)
    return { ok: false, error: 'invalid' }
  const backup = parsed.data
  return {
    ok: true,
    backup,
    preview: {
      fileName: file.name,
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
      db.categories.bulkAdd(data.categories),
      db.transactions.bulkAdd(data.transactions),
      db.budgets.bulkAdd(data.budgets),
      db.recurrences.bulkAdd(data.recurrences),
      db.settings.bulkAdd(data.settings),
      db.meta.bulkAdd(data.meta),
    ])
    await db.meta.put({ key: 'lastExportAt', value: backup.exportedAt })
  })
}
