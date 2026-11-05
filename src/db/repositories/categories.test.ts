import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyLocale } from '@/i18n/locale'
import { db } from '../database'
import { categoryName } from '../names'
import { setClock } from '../records'
import { seedDefaults } from '../seed'
import {
  archiveCategory,
  CategoryInUseError,
  countCategoryTransactions,
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  reorderCategories,
  restoreCategory,
  unarchiveCategory,
  updateCategory,
} from './categories'
import { addTransaction, deleteTransaction } from './transactions'

let tick = 0

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  tick = 0
  setClock(() => new Date(Date.UTC(2026, 10, 5, 12, 0, tick++)))
  await seedDefaults()
})

afterEach(() => {
  setClock()
  applyLocale('it')
})

async function expenseNames() {
  return (await listCategories({ kind: 'expense' })).map(categoryName)
}

async function byName(name: string) {
  const categories = await listCategories({ includeArchived: true })
  const category = categories.find(item => categoryName(item) === name)
  if (!category)
    throw new Error(`No category ${name}`)
  return category
}

function spend(categoryId: string) {
  return addTransaction({
    kind: 'expense',
    amountCents: 4500,
    date: '2026-11-05',
    accountId: 'cash',
    categoryId,
    note: '',
  })
}

describe('categories repository', () => {
  it('creates a category at the end of its kind, with a clean name', async () => {
    const created = await createCategory({
      kind: 'expense',
      name: '  Palestra  ',
      icon: 'barbell',
      color: 6,
    })
    expect(created).toMatchObject({ name: 'Palestra', order: 12, archived: false })
    expect(created.preset).toBeUndefined()
    expect((await expenseNames()).at(-1)).toBe('Palestra')
    // The other kind starts its own count.
    const income = await createCategory({
      kind: 'income',
      name: 'Affitti',
      icon: 'house',
      color: 2,
    })
    expect(income.order).toBe(4)
  })

  it('refuses an empty name or one longer than 24 characters', async () => {
    await expect(createCategory({
      kind: 'expense',
      name: '   ',
      icon: 'heart',
      color: 1,
    })).rejects.toThrow(RangeError)
    await expect(createCategory({
      kind: 'expense',
      name: 'x'.repeat(25),
      icon: 'heart',
      color: 1,
    })).rejects.toThrow(RangeError)
  })

  it('detaches a renamed default category from the translation, and reattaches it', async () => {
    const groceries = await byName('Spesa')
    await updateCategory(groceries.id, { name: 'Alimentari', icon: 'shopping-bag' })
    applyLocale('en')
    expect(categoryName((await getCategory(groceries.id))!)).toBe('Alimentari')

    // Typing back the translation of the preset makes it follow the language again.
    await updateCategory(groceries.id, { name: 'Groceries' })
    const restored = (await getCategory(groceries.id))!
    expect(restored.name).toBeUndefined()
    expect(restored.icon).toBe('shopping-bag')
    applyLocale('it')
    expect(categoryName(restored)).toBe('Spesa')
  })

  it('keeps the translation when the default name is saved unchanged', async () => {
    const home = await byName('Casa')
    await updateCategory(home.id, { name: 'Casa', color: 5 })
    const saved = (await getCategory(home.id))!
    expect(saved.color).toBe(5)
    expect('name' in saved).toBe(false)
  })

  it('saves a new order and touches only the rows that moved', async () => {
    const before = await listCategories({ kind: 'expense' })
    const ids = before.map(category => category.id)
    const moved = [
      ids[2]!,
      ids[0]!,
      ids[1]!,
      ...ids.slice(3),
    ]
    await reorderCategories(moved)

    expect((await expenseNames()).slice(0, 4)).toEqual([
      'Ristoranti',
      'Spesa',
      'Casa',
      'Trasporti',
    ])
    const after = await listCategories({ kind: 'expense' })
    expect(after[3]!.updatedAt).toBe(before[3]!.updatedAt)
    expect(after[0]!.updatedAt).not.toBe(before[2]!.updatedAt)
  })

  it('archives a category out of the grid and brings it back at the end, or where it was', async () => {
    const pets = await byName('Animali')
    await archiveCategory(pets.id)
    expect(await expenseNames()).not.toContain('Animali')
    expect((await listCategories({ kind: 'expense', includeArchived: true })).map(categoryName)).toContain('Animali')

    await unarchiveCategory(pets.id)
    expect((await expenseNames()).at(-1)).toBe('Animali')

    await archiveCategory(pets.id)
    await unarchiveCategory(pets.id, pets.order)
    expect((await expenseNames()).indexOf('Animali')).toBe(10)
  })

  it('deletes only a category no transaction uses', async () => {
    const travel = await byName('Viaggi')
    const transaction = await spend(travel.id)
    expect(await countCategoryTransactions(travel.id)).toBe(1)
    await expect(deleteCategory(travel.id)).rejects.toBeInstanceOf(CategoryInUseError)
    expect(await getCategory(travel.id)).toBeDefined()

    // A deleted transaction no longer counts.
    await deleteTransaction(transaction.id)
    await deleteCategory(travel.id)
    expect(await getCategory(travel.id)).toBeUndefined()
    expect(await expenseNames()).not.toContain('Viaggi')

    await restoreCategory(travel.id)
    expect(await expenseNames()).toContain('Viaggi')
  })
})
