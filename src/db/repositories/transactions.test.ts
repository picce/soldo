import type { NewTransaction } from './transactions'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../database'
import { setClock } from '../records'
import {
  addTransaction,
  deleteTransaction,
  duplicateTransaction,
  getTransaction,
  listTransactions,
  restoreTransaction,
  updateTransaction,
} from './transactions'

function expense(overrides: Partial<NewTransaction> = {}): NewTransaction {
  return {
    kind: 'expense',
    amountCents: 1240,
    date: '2026-11-05',
    accountId: 'cash',
    categoryId: 'groceries',
    note: '',
    ...overrides,
  }
}

let tick = 0

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  // A clock that moves forward on every call, so creation order is deterministic.
  tick = 0
  setClock(() => new Date(Date.UTC(2026, 10, 5, 12, 0, tick++)))
})

afterEach(() => setClock())

describe('transactions repository', () => {
  it('adds a transaction with id, timestamps and defaults', async () => {
    const added = await addTransaction(expense())
    expect(added.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(added).toMatchObject({ currency: 'EUR', source: 'manual', deletedAt: null })
    expect(added.createdAt).toBe(added.updatedAt)
    expect(await getTransaction(added.id)).toEqual(added)
  })

  it('rejects amounts that are not positive integer cents, and invalid dates', async () => {
    await expect(addTransaction(expense({ amountCents: 0 }))).rejects.toThrow(RangeError)
    await expect(addTransaction(expense({ amountCents: 12.5 }))).rejects.toThrow(RangeError)
    await expect(addTransaction(expense({ date: '2026-02-30' }))).rejects.toThrow(RangeError)
    await expect(updateTransaction('any', { amountCents: -1 })).rejects.toThrow(RangeError)
  })

  it('lists by date range, kind and category, newest first', async () => {
    const older = await addTransaction(expense({ date: '2026-10-31' }))
    const first = await addTransaction(expense({ date: '2026-11-02' }))
    const second = await addTransaction(expense({ date: '2026-11-02', categoryId: 'home' }))
    const income = await addTransaction(expense({ kind: 'income', date: '2026-11-03', categoryId: 'salary' }))

    const november = await listTransactions({ from: '2026-11-01', to: '2026-11-30' })
    expect(november.map(t => t.id)).toEqual([income.id, second.id, first.id])
    expect((await listTransactions()).map(t => t.id)).toEqual([
      income.id,
      second.id,
      first.id,
      older.id,
    ])
    expect((await listTransactions({
      kinds: ['expense'],
      from: '2026-11-01',
    })).map(t => t.id)).toEqual([second.id, first.id])
    expect((await listTransactions({
      categoryIds: ['home'],
    })).map(t => t.id)).toEqual([second.id])
  })

  it('deletes softly and restores', async () => {
    const added = await addTransaction(expense())
    await deleteTransaction(added.id)

    expect(await getTransaction(added.id)).toBeUndefined()
    expect(await listTransactions()).toEqual([])
    expect((await db.transactions.get(added.id))?.deletedAt).not.toBeNull()

    await restoreTransaction(added.id)
    expect((await getTransaction(added.id))?.deletedAt).toBeNull()
  })

  it('updates fields and the modification time', async () => {
    const added = await addTransaction(expense())
    await updateTransaction(added.id, { amountCents: 990, note: 'Pane' })
    const updated = await getTransaction(added.id)
    expect(updated).toMatchObject({ amountCents: 990, note: 'Pane', createdAt: added.createdAt })
    expect(updated!.updatedAt > added.updatedAt).toBe(true)
  })

  it('duplicates a transaction on another date', async () => {
    const original = await addTransaction(expense({ note: 'Caffè' }))
    const copy = await duplicateTransaction(original.id, '2026-11-06')

    expect(copy.id).not.toBe(original.id)
    expect(copy).toMatchObject({
      kind: 'expense',
      amountCents: 1240,
      categoryId: 'groceries',
      note: 'Caffè',
      date: '2026-11-06',
    })
    await deleteTransaction(original.id)
    await expect(duplicateTransaction(original.id, '2026-11-07')).rejects.toThrow()
  })
})
