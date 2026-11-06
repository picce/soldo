import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyLocale } from '@/i18n/locale'
import { db } from './database'
import { accountName, categoryName } from './names'
import { getDefaultAccount } from './repositories/accounts'
import { addCategory, listCategories } from './repositories/categories'
import { getMeta } from './repositories/meta'
import { SCHEMA_VERSION } from './schema'
import { seedDefaults } from './seed'

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
})

afterEach(() => applyLocale('it'))

describe('seedDefaults', () => {
  it('creates the default categories and the cash account', async () => {
    expect(await seedDefaults()).toBe(true)

    const expenses = await listCategories({ kind: 'expense' })
    const income = await listCategories({ kind: 'income' })
    expect(expenses.map(categoryName)).toEqual([
      'Spesa',
      'Casa',
      'Ristoranti',
      'Trasporti',
      'Svago',
      'Bollette',
      'Salute',
      'Vestiti',
      'Regali',
      'Viaggi',
      'Animali',
      'Altro',
    ])
    expect(income.map(categoryName)).toEqual([
      'Stipendio',
      'Rimborsi',
      'Regali ricevuti',
      'Altre entrate',
    ])
    expect(expenses.map(category => category.color)).toEqual([1, 2, 3, 4, 5, 7, 8, 1, 2, 3, 4, 6])

    const account = await getDefaultAccount()
    expect(account && accountName(account)).toBe('Contanti')
    expect(await getMeta('schemaVersion')).toBe(SCHEMA_VERSION)
    const methods = await db.paymentMethods.orderBy('order').toArray()
    expect(methods.map(method => method.preset)).toEqual([
      'cash',
      'card',
      'satispay',
      'bankTransfer',
      'other',
    ])
    expect(new Set(methods.map(method => method.accountId))).toEqual(new Set([account!.id]))
  })

  it('runs only once', async () => {
    await seedDefaults()
    expect(await seedDefaults()).toBe(false)
    expect(await db.categories.count()).toBe(16)
    expect(await db.accounts.count()).toBe(1)
  })

  it('does nothing when categories already exist (e.g. after a restore)', async () => {
    await addCategory({
      kind: 'expense',
      name: 'Palestra',
      icon: 'barbell',
      color: 2,
      order: 0,
      archived: false,
    })
    expect(await seedDefaults()).toBe(false)
    expect(await db.categories.count()).toBe(1)
  })
})

describe('display names', () => {
  it('translate defaults until the user renames them', async () => {
    await seedDefaults()
    const [groceries] = await listCategories({ kind: 'expense' })

    applyLocale('en')
    expect(categoryName(groceries!)).toBe('Groceries')
    expect(categoryName({ ...groceries!, name: 'Supermercato' })).toBe('Supermercato')
  })

  it('hides archived categories unless asked', async () => {
    await addCategory({
      kind: 'expense',
      name: 'Vecchia',
      icon: 'gift',
      color: 1,
      order: 0,
      archived: true,
    })
    expect(await listCategories()).toEqual([])
    expect(await listCategories({ includeArchived: true })).toHaveLength(1)
  })
})
