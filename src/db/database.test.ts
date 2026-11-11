import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { SoldoDatabase } from './database'
import { SCHEMA_VERSION } from './schema'

const NAME = 'soldo-upgrade-test'
const open: Dexie[] = []

/** The database as version 0.4.0 of the app left it. */
async function version1(accounts: object[], transactions: object[] = []) {
  const old = new Dexie(NAME)
  old.version(1).stores({
    accounts: 'id, order',
    categories: 'id, kind, order',
    transactions: 'id, date, [kind+date], categoryId, accountId, updatedAt, externalId',
    budgets: 'id, month, categoryId',
    recurrences: 'id',
    settings: 'key',
    meta: 'key',
  })
  await old.open()
  await old.table('accounts').bulkAdd(accounts)
  await old.table('transactions').bulkAdd(transactions)
  await old.table('meta').put({ key: 'schemaVersion', value: 1 })
  open.push(old)
  return old
}

function account(id: string, order: number, archived = false) {
  return { id, order, archived, deletedAt: null }
}

function upgraded() {
  const db = new SoldoDatabase(NAME)
  open.push(db)
  return db
}

afterEach(async () => {
  open.splice(0).forEach(db => db.close())
  await Dexie.delete(NAME)
})

describe('upgrade to version 2', () => {
  it('creates the default payment methods on the first active account', async () => {
    const old = await version1([
      account('closed', 0, true),
      account('bank', 1),
      account('cash', 2),
    ])
    old.close()

    const methods = await upgraded().paymentMethods.orderBy('order').toArray()
    expect(methods.map(method => method.preset)).toEqual([
      'cash',
      'card',
      'satispay',
      'bankTransfer',
      'other',
    ])
    expect(new Set(methods.map(method => method.accountId))).toEqual(new Set(['bank']))
  })

  it('leaves the transactions as they were and records the new version', async () => {
    const transaction = {
      id: 't1',
      kind: 'expense',
      amountCents: 500,
      date: '2026-11-01',
      accountId: 'bank',
      updatedAt: '2026-11-01T10:00:00.000Z',
    }
    const old = await version1([
      account('bank', 0),
    ], [transaction])
    old.close()

    const db = upgraded()
    expect(await db.transactions.toArray()).toEqual([transaction])
    expect((await db.meta.get('schemaVersion'))?.value).toBe(SCHEMA_VERSION)
  })

  it('adds nothing to a database with no accounts yet: seedDefaults does it', async () => {
    const old = await version1([])
    old.close()
    expect(await upgraded().paymentMethods.count()).toBe(0)
  })

  it('takes the database from another tab still open on version 1', async () => {
    await version1([
      account('bank', 0),
    ])
    expect(await upgraded().paymentMethods.count()).toBe(5)
  })
})

describe('upgrade to version 3', () => {
  it('adds the empty tables of the import and keeps the data', async () => {
    const old = new Dexie(NAME)
    old.version(2).stores({
      accounts: 'id, order',
      categories: 'id, kind, order',
      transactions: 'id, date, [kind+date], categoryId, accountId, updatedAt, externalId',
      budgets: 'id, month, categoryId',
      recurrences: 'id',
      settings: 'key',
      meta: 'key',
      paymentMethods: 'id, order',
    })
    await old.open()
    await old.table('accounts').add(account('bank', 0))
    await old.table('meta').put({ key: 'schemaVersion', value: 2 })
    old.close()

    const db = upgraded()
    expect(await db.accounts.count()).toBe(1)
    expect(await db.importRules.count()).toBe(0)
    expect(await db.importPresets.where('signature').equals('x').count()).toBe(0)
    expect((await db.meta.get('schemaVersion'))?.value).toBe(SCHEMA_VERSION)
  })
})
