import type { BackupFile } from './format'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/database'
import { setClock } from '@/db/records'
import { getDefaultAccount } from '@/db/repositories/accounts'
import { listBudgets, removeBudget, setBudget } from '@/db/repositories/budgets'
import { listCategories } from '@/db/repositories/categories'
import { getMeta } from '@/db/repositories/meta'
import { listPaymentMethods } from '@/db/repositories/payment-methods'
import { createRecurrence, getRecurrence } from '@/db/repositories/recurrences'
import { addTransaction, deleteTransaction, listTransactions } from '@/db/repositories/transactions'
import { SCHEMA_VERSION } from '@/db/schema'
import { seedDefaults } from '@/db/seed'
import { createBackupKey, encryptBytes } from './crypto'
import { backupEncryption, disableEncryption } from './encryption'
import { createBackup } from './export'
import { readBackup, readBackupBytes, restoreBackup, unlockBackup } from './import'
import { gzip, packBackup, sha256Hex } from './pack'

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
  it('reads a compressed backup too, as downloaded from Google Drive', async () => {
    await addSome()
    const bytes = await gzip(JSON.stringify(await createBackup()))
    const reading = await readBackup(new File([bytes], 'soldo-backup-2026-11-02.json.gz', { type: 'application/gzip' }))
    expect(reading.ok && reading.preview).toMatchObject({ fileName: 'soldo-backup-2026-11-02.json.gz', transactions: 2 })
  })

  it('reads its own export and previews what it holds', async () => {
    await addSome()
    const backup = await createBackup()
    expect(backup).toMatchObject({ app: 'soldo', format: 4, schemaVersion: 3 })
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
    const withoutMeta = (tables: unknown[][]) => tables.filter((_, index) => db.tables[index]!.name !== 'meta')
    expect(withoutMeta(after)).toEqual(withoutMeta(before))
    expect(await listTransactions()).toHaveLength(2)
    // The device now holds the data of that file: it counts as the last backup.
    expect(await getMeta('lastExportAt')).toBe(backup.exportedAt)
  })

  it('keeps payment methods and the method of each expense through a backup', async () => {
    const [method] = await listPaymentMethods()
    const account = await getDefaultAccount()
    const [groceries] = await listCategories({ kind: 'expense' })
    const saved = await addTransaction({
      kind: 'expense',
      amountCents: 500,
      accountId: account!.id,
      categoryId: groceries!.id,
      date: '2026-11-02',
      note: '',
      paymentMethodId: method!.id,
    })
    const reading = await readBackup(asFile(await createBackup()))
    await Promise.all(db.tables.map(table => table.clear()))
    await restoreBackup(reading.ok
      ? reading.backup
      : expect.fail('not read'))
    expect(await listPaymentMethods()).toHaveLength(5)
    expect((await db.transactions.get(saved.id))?.paymentMethodId).toBe(method!.id)
  })

  it('keeps the end of a budget through a backup', async () => {
    await setBudget({
      month: '2026-01',
      categoryId: null,
      amountCents: 100000,
      repeat: true,
    })
    await removeBudget('2026-03', null)
    const before = await listBudgets()
    const reading = await readBackup(asFile(await createBackup()))
    await Promise.all(db.tables.map(table => table.clear()))
    await restoreBackup(reading.ok
      ? reading.backup
      : expect.fail('not read'))
    expect(await listBudgets()).toEqual(before)
    expect(before[0]?.endMonth).toBe('2026-02')
  })

  it('keeps a series with its payment method, and adds what came due once restored', async () => {
    vi.useFakeTimers({
      toFake: ['Date'],
    })
    vi.setSystemTime(new Date(2026, 10, 7, 10))
    try {
      const [method] = await listPaymentMethods()
      const [groceries] = await listCategories({ kind: 'expense' })
      const series = await createRecurrence({
        template: {
          kind: 'expense',
          amountCents: 1299,
          accountId: method!.accountId,
          paymentMethodId: method!.id,
          categoryId: groceries!.id,
          note: 'Netflix',
        },
        freq: 'monthly',
        interval: 1,
        startDate: '2026-10-09',
      })
      const reading = await readBackup(asFile(await createBackup()))
      await Promise.all(db.tables.map(table => table.clear()))
      await restoreBackup(reading.ok
        ? reading.backup
        : expect.fail('not read'))
      expect((await getRecurrence(series.id))?.template.paymentMethodId).toBe(method!.id)
      expect((await listTransactions()).map(transaction => [transaction.date, transaction.note])).toEqual([
        ['2026-10-09', 'Netflix'],
      ])
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('reads a file of format 2 as it is', async () => {
    await setBudget({
      month: '2026-01',
      categoryId: null,
      amountCents: 100000,
      repeat: true,
    })
    const reading = await readBackup(asFile({
      ...await createBackup(),
      format: 2,
    }))
    expect(reading.ok).toBe(true)
    if (reading.ok) {
      expect(reading.backup.format).toBe(4)
      expect(reading.backup.data.budgets).toHaveLength(1)
    }
  })

  it('reads a file of format 3, without rules and presets of the import', async () => {
    await addSome()
    const { data: { importRules: _, importPresets: __, ...data }, ...backup } = await createBackup()
    const reading = await readBackup(asFile({
      ...backup,
      format: 3,
      schemaVersion: 2,
      data,
    }))
    expect(reading.ok && [reading.backup.data.importRules, reading.backup.data.importPresets]).toEqual([[], []])
  })

  describe('of format 1', () => {
    /** A backup as the app wrote it before the payment methods. */
    async function format1() {
      await addSome()
      const { data: { paymentMethods: _, ...data }, ...backup } = await createBackup()
      return {
        ...backup,
        format: 1,
        schemaVersion: 1,
        data,
      }
    }

    it('gets the default payment methods, on its first active account', async () => {
      const old = await format1()
      const accounts = old.data.accounts
      const reading = await readBackup(asFile({
        ...old,
        data: {
          ...old.data,
          accounts: [
            {
              ...accounts[0]!,
              id: 'closed',
              order: 0,
              archived: true,
            },
            { ...accounts[0]!, id: 'bank', order: 1 },
          ],
        },
      }))
      expect(reading.ok).toBe(true)
      if (reading.ok) {
        expect(reading.backup.format).toBe(4)
        expect(reading.backup.data.paymentMethods.map(method => method.preset)).toEqual([
          'cash',
          'card',
          'satispay',
          'bankTransfer',
          'other',
        ])
        expect(new Set(reading.backup.data.paymentMethods.map(method => method.accountId))).toEqual(new Set(['bank']))
      }
    })

    it('restores, with transactions as they were and the current schema version', async () => {
      const old = await format1()
      const reading = await readBackup(asFile(old))
      await Promise.all(db.tables.map(table => table.clear()))
      await restoreBackup(reading.ok
        ? reading.backup
        : expect.fail('not read'))
      expect(await listTransactions()).toHaveLength(2)
      expect(await listPaymentMethods()).toHaveLength(5)
      expect(await getMeta('schemaVersion')).toBe(SCHEMA_VERSION)
    })

    it('still passes the checksum Drive keeps for it', async () => {
      const old = await format1()
      const bytes = new TextEncoder().encode(JSON.stringify(old))
      const checksum = await sha256Hex(JSON.stringify(old.data))
      const reading = await readBackupBytes(bytes, 'old.json', checksum)
      expect(reading.ok).toBe(true)
    })

    it('is refused when its data is broken', async () => {
      const old = await format1()
      expect(await readBackup(asFile({
        ...old,
        data: { ...old.data, accounts: 'nope' },
      })))
        .toEqual({ ok: false, error: 'invalid' })
    })
  })

  it('refuses files that are not Soldo backups', async () => {
    expect(await readBackup(asFile('not json'))).toEqual({ ok: false, error: 'notSoldo' })
    expect(await readBackup(asFile({ app: 'other', format: 1 }))).toEqual({ ok: false, error: 'notSoldo' })
    expect(await readBackup(asFile([1, 2]))).toEqual({ ok: false, error: 'notSoldo' })
  })

  it('refuses a backup of a newer format', async () => {
    const backup = await createBackup()
    expect(await readBackup(asFile({ ...backup, format: 5 }))).toEqual({ ok: false, error: 'newerFormat' })
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

describe('an encrypted backup', () => {
  afterEach(() => disableEncryption())

  async function encrypted(passphrase = 'correct horse battery') {
    await addSome()
    const backup = await createBackup()
    const bytes = await encryptBytes(await packBackup(backup), await createBackupKey(passphrase, 10))
    return { backup, bytes }
  }

  it('waits for the passphrase before reading anything', async () => {
    const { bytes } = await encrypted()
    const reading = await readBackup(new File([bytes], 'soldo-backup-2026-11-02.soldo'))
    expect(reading).toMatchObject({
      ok: false,
      error: 'locked',
      locked: { fileName: 'soldo-backup-2026-11-02.soldo' },
    })
  })

  it('does not open with the wrong passphrase, and opens with the right one', async () => {
    const { backup, bytes } = await encrypted()
    const reading = await readBackupBytes(bytes, 'soldo-backup-2026-11-02.soldo')
    if (reading.ok || reading.error !== 'locked')
      throw new Error('expected a locked backup')
    expect(await unlockBackup(reading.locked, 'wrong horse battery')).toEqual({ ok: false, error: 'wrongPassphrase' })
    const opened = await unlockBackup(reading.locked, 'correct horse battery')
    expect(opened.ok && opened.preview).toMatchObject({ exportedAt: backup.exportedAt, transactions: 2 })
    expect(opened.ok && opened.key?.iterations).toBe(10)
  })

  it('still checks the checksum Drive keeps, once open', async () => {
    const { backup, bytes } = await encrypted()
    const good = await sha256Hex(JSON.stringify(backup.data))
    for (const [checksum, ok] of [
      [good, true],
      [
        'a'.repeat(64),
        false,
      ],
    ] as const) {
      const reading = await readBackupBytes(bytes, 'soldo-backup-2026-11-02.soldo', checksum)
      if (reading.ok || reading.error !== 'locked')
        throw new Error('expected a locked backup')
      expect((await unlockBackup(reading.locked, 'correct horse battery')).ok).toBe(ok)
    }
  })

  it('once restored, leaves the device encrypting with the same passphrase', async () => {
    const { bytes } = await encrypted()
    const reading = await readBackupBytes(bytes, 'soldo-backup-2026-11-02.soldo')
    if (reading.ok || reading.error !== 'locked')
      throw new Error('expected a locked backup')
    const opened = await unlockBackup(reading.locked, 'correct horse battery')
    if (!opened.ok)
      throw new Error('expected an open backup')
    expect(backupEncryption.value).toBeNull()
    await Promise.all(db.tables.map(table => table.clear()))
    await restoreBackup(opened.backup, opened.key)
    expect(await listTransactions()).toHaveLength(2)
    expect(backupEncryption.value).not.toBeNull()
  })
})
