import type { ImportPlan } from './import'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../database'
import { setClock } from '../records'
import { seedDefaults } from '../seed'
import {
  commitImport,
  deleteImportRule,
  duplicateCandidates,
  fallbackCategories,
  findImportPreset,
  importedExternalIds,
  listImportRules,
  restoreImportRule,
  saveImportRule,
  undoImport,
} from './import'
import { addTransaction } from './transactions'

let tick = 0
let accountId: string
let categories: Record<string, string>

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  tick = 0
  setClock(() => new Date(Date.UTC(2026, 10, 5, 12, 0, tick++)))
  await seedDefaults()
  accountId = (await db.accounts.toArray())[0]!.id
  categories = Object.fromEntries((await db.categories.toArray()).map(category => [category.preset!, category.id]))
})

afterEach(() => setClock())

function plan(overrides: Partial<ImportPlan> = {}): ImportPlan {
  return {
    accountId,
    add: [
      {
        externalId: 'imp1:a',
        date: '2026-03-02',
        amountCents: -4590,
        note: 'ESSELUNGA',
        categoryId: categories.groceries!,
      },
      {
        externalId: 'imp1:b',
        date: '2026-03-05',
        amountCents: 185000,
        note: 'ACME SRL',
        categoryId: categories.salary!,
      },
    ],
    merge: [],
    rules: [],
    ...overrides,
  }
}

describe('import rules', () => {
  it('keeps one rule per keyword and kind, and lists them by keyword', async () => {
    const first = await saveImportRule({ pattern: '  Esselunga ', kind: 'expense', categoryId: categories.groceries! })
    const same = await saveImportRule({ pattern: 'ESSELUNGA', kind: 'expense', categoryId: categories.home! })
    await saveImportRule({ pattern: 'acme', kind: 'income', categoryId: categories.salary! })
    expect(first.created).toBe(true)
    expect(same).toMatchObject({
      created: false,
      rule: { id: first.rule.id, pattern: 'ESSELUNGA', categoryId: categories.home },
    })
    expect((await listImportRules()).map(rule => rule.pattern)).toEqual(['acme', 'ESSELUNGA'])
  })

  it('refuses an empty or too long keyword', async () => {
    await expect(saveImportRule({ pattern: '  ', kind: 'expense', categoryId: categories.home! })).rejects.toThrow(RangeError)
    await expect(saveImportRule({
      pattern: 'x'.repeat(41),
      kind: 'expense',
      categoryId: categories.home!,
    })).rejects.toThrow(RangeError)
  })

  it('changing a keyword into another one leaves one rule', async () => {
    const { rule: bar } = await saveImportRule({ pattern: 'bar', kind: 'expense', categoryId: categories.restaurants! })
    await saveImportRule({ pattern: 'bar sport', kind: 'expense', categoryId: categories.leisure! })
    await saveImportRule({
      id: bar.id,
      pattern: 'Bar Sport',
      kind: 'expense',
      categoryId: categories.restaurants!,
    })
    expect((await listImportRules()).map(rule => [rule.pattern, rule.id])).toEqual([
      ['Bar Sport', bar.id],
    ])
  })

  it('deletes and restores a rule, and hides those of a deleted category', async () => {
    const { rule } = await saveImportRule({ pattern: 'netflix', kind: 'expense', categoryId: categories.leisure! })
    await deleteImportRule(rule.id)
    expect(await listImportRules()).toEqual([])
    await restoreImportRule(rule.id)
    expect(await listImportRules()).toHaveLength(1)
    await db.categories.update(categories.leisure!, { deletedAt: '2026-11-05T12:00:00.000Z' })
    expect(await listImportRules()).toEqual([])
  })
})

describe('fallbackCategories', () => {
  it('uses «Altro» and «Altre entrate»', async () => {
    expect(await fallbackCategories()).toEqual({ expense: categories.other, income: categories.otherIncome })
  })
})

describe('commitImport', () => {
  it('adds the movements to the account, expenses with its first payment method', async () => {
    const result = await commitImport(plan())
    const added = await db.transactions.bulkGet(result.added)
    expect(added.map(transaction => [
      transaction!.kind,
      transaction!.amountCents,
      transaction!.source,
      transaction!.externalId,
    ])).toEqual([
      ['expense', 4590, 'import', 'imp1:a'],
      ['income', 185000, 'import', 'imp1:b'],
    ])
    const method = (await db.paymentMethods.orderBy('order').toArray())[0]!
    expect(added[0]).toMatchObject({ accountId, paymentMethodId: method.id, note: 'ESSELUNGA' })
    expect(added[1]!.paymentMethodId).toBeUndefined()
    expect(await importedExternalIds(['imp1:a', 'imp1:c'])).toEqual(new Set(['imp1:a']))
  })

  it('merges a duplicate, keeps rules and preset, and undoes all but the preset', async () => {
    const typed = await addTransaction({
      kind: 'expense',
      amountCents: 120,
      date: '2026-03-06',
      accountId,
      categoryId: categories.restaurants!,
      note: 'Caffè',
    })
    const result = await commitImport(plan({
      add: [],
      merge: [
        { transactionId: typed.id, externalId: 'imp1:coffee' },
      ],
      rules: [
        { pattern: 'bar sport', kind: 'expense', categoryId: categories.restaurants! },
      ],
      preset: {
        signature: 'data|descrizione|importo',
        mapping: {
          date: 0,
          description: 1,
          amount: { kind: 'single', column: 2 },
        },
        dateFormat: 'dmy',
      },
    }))
    expect((await db.transactions.get(typed.id))?.externalId).toBe('imp1:coffee')
    expect(await listImportRules()).toHaveLength(1)
    expect(await findImportPreset('data|descrizione|importo')).toMatchObject({ accountId, dateFormat: 'dmy' })

    await undoImport(result)
    expect((await db.transactions.get(typed.id))?.externalId).toBeUndefined()
    expect(await listImportRules()).toEqual([])
    expect(await findImportPreset('data|descrizione|importo')).toBeDefined()
  })

  it('undoing removes the movements for good, so the file can come in again', async () => {
    const result = await commitImport(plan())
    await undoImport(result)
    expect(await db.transactions.count()).toBe(0)
    expect(await importedExternalIds(['imp1:a'])).toEqual(new Set())
  })

  it('changes nothing when a row is broken', async () => {
    await expect(commitImport(plan({
      add: [
        {
          externalId: 'x',
          date: '2026-02-30',
          amountCents: -1,
          note: '',
          categoryId: categories.other!,
        },
      ],
    }))).rejects.toThrow(RangeError)
    await expect(commitImport(plan({ accountId: 'nope' }))).rejects.toThrow(RangeError)
    expect(await db.transactions.count()).toBe(0)
  })

  it('keeps a deleted import as imported', async () => {
    const result = await commitImport(plan())
    await db.transactions.update(result.added[0]!, { deletedAt: '2026-11-05T12:00:00.000Z' })
    expect(await importedExternalIds(['imp1:a'])).toEqual(new Set(['imp1:a']))
  })
})

describe('duplicateCandidates', () => {
  it('offers what was typed by hand around the dates of the file, not imports or transfers', async () => {
    const near = await addTransaction({
      kind: 'expense',
      amountCents: 120,
      date: '2026-02-27',
      accountId,
      categoryId: categories.restaurants!,
      note: '',
    })
    await addTransaction({
      kind: 'expense',
      amountCents: 120,
      date: '2026-02-25',
      accountId,
      categoryId: categories.restaurants!,
      note: '',
    })
    await addTransaction({
      kind: 'expense',
      amountCents: 120,
      date: '2026-03-01',
      accountId,
      categoryId: categories.restaurants!,
      note: '',
      source: 'import',
      externalId: 'imp1:z',
    })
    const candidates = await duplicateCandidates('2026-03-02', '2026-03-05')
    expect(candidates.map(candidate => candidate.id)).toEqual([near.id])
  })
})
