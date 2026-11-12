import type { BackupFile } from './format'
import { db } from '@/db/database'
import { accountName, categoryName, paymentMethodName, transferRoute } from '@/db/names'
import { now } from '@/db/records'
import { setMeta } from '@/db/repositories/meta'
import { SCHEMA_VERSION } from '@/db/schema'
import { today } from '@/domain/dates'
import { i18n } from '@/i18n'
import { transactionsToCsv } from './csv'
import { deliverFile } from './deliver'
import { encryptionKey } from './encryption'
import { sealBackup } from './pack'
import { BACKUP_FORMAT } from './version'

// Kept apart from import.ts: exporting does not need the validation library, so the
// Settings page loads it only when a file to import is chosen.

/** Snapshot of every table, deleted rows included, read in one transaction. */
export async function createBackup(): Promise<BackupFile> {
  return db.transaction('r', db.tables, async () => {
    const [accounts, paymentMethods, categories, transactions, budgets, recurrences, importRules, importPresets, settings, meta] = await Promise.all([
      db.accounts.toArray(),
      db.paymentMethods.toArray(),
      db.categories.toArray(),
      db.transactions.toArray(),
      db.budgets.toArray(),
      db.recurrences.toArray(),
      db.importRules.toArray(),
      db.importPresets.toArray(),
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
        paymentMethods,
        categories,
        transactions,
        budgets,
        recurrences,
        importRules,
        importPresets,
        settings,
        meta,
      },
    }
  })
}

export function backupFileName(date = today(), encrypted = false): string {
  return encrypted
    ? `soldo-backup-${date}.soldo`
    : `soldo-backup-${date}.json`
}

/**
 * Builds the backup and hands it to the user (share sheet on a phone, download elsewhere):
 * plain JSON, or an encrypted file when this device encrypts the backups
 * (docs/specs/released/backup-cifrati.md). Remembers when, for «Ultimo backup», unless the user
 * closed the share sheet.
 */
export async function exportBackup(): Promise<'done' | 'cancelled'> {
  const backup = await createBackup()
  let blob: Blob
  let encrypted = false
  if (encryptionKey()) {
    const sealed = await sealBackup(backup)
    blob = new Blob([sealed.bytes], { type: 'application/octet-stream' })
    encrypted = sealed.encrypted
  }
  else {
    blob = new Blob([
      JSON.stringify(backup),
    ], { type: 'application/json' })
  }
  const result = await deliverFile(blob, backupFileName(today(), encrypted))
  if (result === 'cancelled')
    return result
  await setMeta('lastExportAt', backup.exportedAt)
  return 'done'
}

/** The transactions as a CSV file in the app language (not a backup: it cannot be imported). */
export async function exportTransactionsCsv(): Promise<'done' | 'cancelled'> {
  const [transactions, categories, accounts, paymentMethods] = await Promise.all([
    db.transactions.toArray(),
    db.categories.toArray(),
    db.accounts.toArray(),
    db.paymentMethods.toArray(),
  ])
  const categoriesById = new Map(categories.map(category => [category.id, category]))
  const accountsById = new Map(accounts.map(account => [account.id, account]))
  const paymentMethodsById = new Map(paymentMethods.map(method => [method.id, method]))
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
        t('csv.payment'),
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
      if (transaction.kind === 'transfer')
        return transferRoute(account, accountsById.get(transaction.toAccountId ?? ''))
      return account
        ? accountName(account)
        : ''
    },
    paymentName: (transaction) => {
      const method = transaction.paymentMethodId
        ? paymentMethodsById.get(transaction.paymentMethodId)
        : undefined
      return method
        ? paymentMethodName(method)
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
