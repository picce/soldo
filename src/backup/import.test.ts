import type { BackupFile } from './format'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/database'
import { setClock } from '@/db/records'
import { getDefaultAccount } from '@/db/repositories/accounts'
import { listCategories } from '@/db/repositories/categories'
import { getMeta } from '@/db/repositories/meta'
import { addTransaction, deleteTransaction, listTransactions } from '@/db/repositories/transactions'
import { seedDefaults } from '@/db/seed'
import { createBackup } from './export'
import { readBackup, restoreBackup } from './import'

let tick = 0

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  tick = 0
  setClock(() => new Date(Date.UTC(2026, 10, 2, 20, 14, tick++)))
  await seedDefaults()
})

afterEach(() => setClock())

async function addSome() {
  const account = await getDefaultAccount()
  const [groceries, home] = await listCategories({ kind: 'expense' })
  const base = {
    kind: 'expense' as const,
    accountId: account!.id,
    date: '2026-11-02',
    note: '',
  }
  await addTransaction({
    ...base,
    amountCents: 1240,
    categoryId: groceries!.id,
    note: 'Esselunga',
  })
  await addTransaction({ ...base, amountCents: 65000, categoryId: home!.id })
  const deleted = await addTransaction({ ...base, amountCents: 100, categoryId: home!.id })
  await deleteTransaction(deleted.id)
}

function asFile(content: unknown, name = 'soldo-backup-2026-11-02.json') {
  const text = typeof content === 'string'
    ? content
    : JSON.stringify(content)
  return new File([text], name, { type: 'application/json' })
}

async function snapshot() {
  return Promise.all(db.tables.map(table => table.toArray()))
}

describe('backup', () => {
  it('reads its own export and previews what it holds', async () => {
    await addSome()
    const backup = await createBackup()
    expect(backup).toMatchObject({ app: 'soldo', format: 1, schemaVersion: 1 })
    expect(backup.data.transactions).toHaveLength(3)

    const reading = await readBackup(asFile(backup))
    expect(reading.ok).toBe(true)
    if (reading.ok) {
      expect(reading.preview).toEqual({
        fileName: 'soldo-backup-2026-11-02.json',
        exportedAt: backup.exportedAt,
        transactions: 2,
        categories: 16,
        accounts: 1,
      })
    }
  })

  it('restores the same data, deleted rows included, replacing what was there', async () => {
    await addSome()
    const backup: BackupFile = JSON.parse(JSON.stringify(await createBackup()))
    const before = await snapshot()

    // Different data on the device: it must disappear.
    await Promise.all(db.tables.map(table => table.clear()))
    await seedDefaults()
    await restoreBackup(backup)

    const after = await snapshot()
    const withoutMeta = (tables: unknown[][]) => tables.slice(0, -1)
    expect(withoutMeta(after)).toEqual(withoutMeta(before))
    expect(await listTransactions()).toHaveLength(2)
    // The device now holds the data of that file: it counts as the last backup.
    expect(await getMeta('lastExportAt')).toBe(backup.exportedAt)
  })

  it('refuses files that are not Soldo backups', async () => {
    expect(await readBackup(asFile('not json'))).toEqual({ ok: false, error: 'notSoldo' })
    expect(await readBackup(asFile({ app: 'other', format: 1 }))).toEqual({ ok: false, error: 'notSoldo' })
    expect(await readBackup(asFile([1, 2]))).toEqual({ ok: false, error: 'notSoldo' })
  })

  it('refuses a backup of a newer format', async () => {
    const backup = await createBackup()
    expect(await readBackup(asFile({ ...backup, format: 2 }))).toEqual({ ok: false, error: 'newerFormat' })
  })

  it('refuses invalid records', async () => {
    await addSome()
    const backup = await createBackup()
    const broken = structuredClone(backup)
    broken.data.transactions[0]!.amountCents = 12.5
    expect(await readBackup(asFile(broken))).toEqual({ ok: false, error: 'invalid' })

    const missing = structuredClone(backup) as { data: Partial<BackupFile['data']> }
    delete missing.data.categories
    expect(await readBackup(asFile(missing))).toEqual({ ok: false, error: 'invalid' })
  })

  it('changes nothing when a record cannot be written', async () => {
    await addSome()
    const backup = await createBackup()
    const before = await snapshot()
    // Two transactions with the same id: the second write fails, and so does the whole restore.
    const clash = structuredClone(backup)
    clash.data.categories = clash.data.categories.slice(0, 2)
    clash.data.transactions.push({ ...clash.data.transactions[0]! })

    await expect(restoreBackup(clash)).rejects.toThrow()
    expect(await snapshot()).toEqual(before)
  })
})
