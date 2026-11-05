import type { BackupFile } from './format'
import { db } from '@/db/database'
import { accountName, categoryName } from '@/db/names'
import { now } from '@/db/records'
import { setMeta } from '@/db/repositories/meta'
import { SCHEMA_VERSION } from '@/db/schema'
import { today } from '@/domain/dates'
import { i18n } from '@/i18n'
import { transactionsToCsv } from './csv'
import { deliverFile } from './deliver'
import { BACKUP_FORMAT } from './version'

// Kept apart from import.ts: exporting does not need the validation library, so the
// Settings page loads it only when a file to import is chosen.

/** Snapshot of every table, deleted rows included, read in one transaction. */
export async function createBackup(): Promise<BackupFile> {
  return db.transaction('r', db.tables, async () => {
    const [accounts, categories, transactions, budgets, recurrences, settings, meta] = await Promise.all([
      db.accounts.toArray(),
      db.categories.toArray(),
      db.transactions.toArray(),
      db.budgets.toArray(),
      db.recurrences.toArray(),
      db.settings.toArray(),
      db.meta.toArray(),
    ])
    return {
      app: 'soldo',
      format: BACKUP_FORMAT,
      exportedAt: now(),
      appVersion: __APP_VERSION__,
      schemaVersion: SCHEMA_VERSION,
      data: {
        accounts,
        categories,
        transactions,
        budgets,
        recurrences,
        settings,
        meta,
      },
    }
  })
}

export function backupFileName(date = today()): string {
  return `soldo-backup-${date}.json`
}

/**
 * Builds the backup and hands it to the user (share sheet on a phone, download elsewhere).
 * Remembers when, for «Ultimo backup», unless the user closed the share sheet.
 */
export async function exportBackup(): Promise<'done' | 'cancelled'> {
  const backup = await createBackup()
  const blob = new Blob([
    JSON.stringify(backup),
  ], { type: 'application/json' })
  const result = await deliverFile(blob, backupFileName())
  if (result === 'cancelled')
    return result
  await setMeta('lastExportAt', backup.exportedAt)
  return 'done'
}

/** The transactions as a CSV file in the app language (not a backup: it cannot be imported). */
export async function exportTransactionsCsv(): Promise<'done' | 'cancelled'> {
  const [transactions, categories, accounts] = await Promise.all([
    db.transactions.toArray(),
    db.categories.toArray(),
    db.accounts.toArray(),
  ])
  const categoriesById = new Map(categories.map(category => [category.id, category]))
  const accountsById = new Map(accounts.map(account => [account.id, account]))
  const { t, locale } = i18n.global
  const csv = transactionsToCsv(transactions, {
    locale: locale.value,
    labels: {
      headers: [
        t('csv.date'),
        t('csv.kind'),
        t('csv.amount'),
        t('csv.category'),
        t('csv.account'),
        t('csv.note'),
      ],
      kinds: {
        expense: t('csv.expense'),
        income: t('csv.income'),
        transfer: t('csv.transfer'),
      },
    },
    categoryName: (transaction) => {
      const category = transaction.categoryId
        ? categoriesById.get(transaction.categoryId)
        : undefined
      return category
        ? categoryName(category)
        : ''
    },
    accountName: (transaction) => {
      const account = accountsById.get(transaction.accountId)
      return account
        ? accountName(account)
        : ''
    },
  })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const result = await deliverFile(blob, t('csv.fileName', {
    date: today(),
  }))
  return result === 'cancelled'
    ? result
    : 'done'
}
