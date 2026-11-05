import type { Account, BaseRecord, Category, CategoryPreset, PaletteColor } from './schema'
import { db } from './database'
import { newRecord } from './records'
import { DEFAULT_CURRENCY, SCHEMA_VERSION } from './schema'

type CategorySeed = [preset: CategoryPreset, icon: string, color: PaletteColor]

/** Default categories, in the order of the quick-add grid (docs/design/README.md). */
const EXPENSE_CATEGORIES: CategorySeed[] = [
  ['groceries', 'shopping-cart', 1],
  ['home', 'house', 2],
  ['restaurants', 'fork-knife', 3],
  ['transport', 'bus', 4],
  ['leisure', 'popcorn', 5],
  ['bills', 'lightning', 7],
  ['health', 'first-aid', 8],
  ['clothes', 't-shirt', 1],
  ['gifts', 'gift', 2],
  ['travel', 'airplane-tilt', 3],
  ['pets', 'paw-print', 4],
  ['other', 'dots-three-outline', 6],
]

const INCOME_CATEGORIES: CategorySeed[] = [
  ['salary', 'hand-coins', 7],
  ['refunds', 'arrow-counter-clockwise', 3],
  ['giftsReceived', 'gift', 5],
  ['otherIncome', 'dots-three-outline', 6],
]

const CASH_ACCOUNT: Omit<Account, keyof BaseRecord> = {
  preset: 'cash',
  type: 'cash',
  icon: 'wallet',
  color: 1,
  initialBalanceCents: 0,
  currency: DEFAULT_CURRENCY,
  archived: false,
  order: 0,
}

function categories(kind: Category['kind'], seeds: CategorySeed[]): Category[] {
  return seeds.map(([preset, icon, color], order) => ({
    ...newRecord(),
    kind,
    preset,
    icon,
    color,
    order,
    archived: false,
  }))
}

/**
 * Creates the default categories and the "Contanti" account, once: with categories already
 * in the database it does nothing and returns false.
 */
export async function seedDefaults(): Promise<boolean> {
  return db.transaction('rw', db.categories, db.accounts, db.meta, async () => {
    if (await db.categories.count())
      return false
    await db.categories.bulkAdd([
      ...categories('expense', EXPENSE_CATEGORIES),
      ...categories('income', INCOME_CATEGORIES),
    ])
    if (!(await db.accounts.count())) {
      await db.accounts.add({
        ...newRecord(),
        ...CASH_ACCOUNT,
      })
    }
    await db.meta.put({ key: 'schemaVersion', value: SCHEMA_VERSION })
    return true
  })
}
