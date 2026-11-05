import type { BaseRecord, Category, CategoryKind, PaletteColor } from '../schema'
import { db } from '../database'
import { categoryName } from '../names'
import { newRecord, now } from '../records'

export interface CategoryQuery {
  kind?: CategoryKind
  /** Archived categories are hidden unless asked for (they stay in the history). */
  includeArchived?: boolean
}

/** Longest category name, in characters (docs/specs/released/gestione-categorie.md). */
export const MAX_CATEGORY_NAME = 24

/** What the user chooses for a category: the rest (order, archived) is managed here. */
export interface CategoryInput {
  kind: CategoryKind
  name: string
  icon: string
  color: PaletteColor
}

export type CategoryChanges = Partial<Pick<CategoryInput, 'name' | 'icon' | 'color'>>

/** Refusal to delete a category that some transactions still use: archive it instead. */
export class CategoryInUseError extends Error {
  constructor(readonly categoryId: string, readonly count: number) {
    super(`Category ${categoryId} is used by ${count} transactions`)
    this.name = 'CategoryInUseError'
  }
}

function validName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (!trimmed || trimmed.length > MAX_CATEGORY_NAME)
    throw new RangeError(`Invalid category name: "${name}"`)
  return trimmed
}

function isActive(category: Category): boolean {
  return category.deletedAt === null
}

/** Categories not deleted, in the user's order. */
export async function listCategories(query: CategoryQuery = {}): Promise<Category[]> {
  const { kind, includeArchived = false } = query
  const rows = await db.categories
    .filter(category =>
      isActive(category)
      && (kind === undefined || category.kind === kind)
      && (includeArchived || !category.archived),
    )
    .toArray()
  return rows.sort((a, b) => a.order - b.order)
}

export async function getCategory(id: string): Promise<Category | undefined> {
  const category = await db.categories.get(id)
  return category?.deletedAt === null
    ? category
    : undefined
}

export async function addCategory(input: Omit<Category, keyof BaseRecord>): Promise<Category> {
  const category: Category = {
    ...newRecord(),
    ...input,
  }
  await db.categories.add(category)
  return category
}

/** Order after every category of the kind, archived ones included. */
async function nextOrder(kind: CategoryKind): Promise<number> {
  const siblings = await db.categories.where('kind').equals(kind).filter(isActive).toArray()
  return siblings.reduce((next, category) => Math.max(next, category.order + 1), 0)
}

/** A category chosen by the user, at the end of the quick-add grid of its kind. */
export async function createCategory(input: CategoryInput): Promise<Category> {
  const name = validName(input.name)
  return db.transaction('rw', db.categories, async () => addCategory({
    kind: input.kind,
    name,
    icon: input.icon,
    color: input.color,
    order: await nextOrder(input.kind),
    archived: false,
  }))
}

/**
 * Changes name, icon or color. A default category keeps following the app language while
 * its name is the translation of its preset; any other name detaches it for good
 * (docs/specs/released/dati-locali.md, "Nomi delle voci predefinite").
 */
export async function updateCategory(id: string, changes: CategoryChanges): Promise<void> {
  const category = await getCategory(id)
  if (!category)
    throw new Error(`Category not found: ${id}`)
  const { name, ...rest } = changes
  const update: Partial<Category> = {
    ...rest,
    updatedAt: now(),
  }
  if (name !== undefined) {
    const trimmed = validName(name)
    update.name = category.preset && trimmed === categoryName({ preset: category.preset })
      ? undefined
      : trimmed
  }
  await db.categories.update(id, update)
}

/** Saves the order of a kind's list: `ids` from first to last. Only moved rows change. */
export async function reorderCategories(ids: string[]): Promise<void> {
  const timestamp = now()
  await db.transaction('rw', db.categories, async () => {
    const rows = await db.categories.bulkGet(ids)
    await Promise.all(rows.map((category, order) => category && category.order !== order
      ? db.categories.update(category.id, { order, updatedAt: timestamp })
      : undefined))
  })
}

/** Hides the category from the quick add; its transactions keep it. */
export async function archiveCategory(id: string): Promise<void> {
  await db.categories.update(id, {
    archived: true,
    updatedAt: now(),
  })
}

/** Brings an archived category back: at `order` (undo) or at the end of the grid. */
export async function unarchiveCategory(id: string, order?: number): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const category = await getCategory(id)
    if (!category)
      return
    await db.categories.update(id, {
      archived: false,
      order: order ?? await nextOrder(category.kind),
      updatedAt: now(),
    })
  })
}

/** Transactions (not deleted) in the category. */
export async function countCategoryTransactions(id: string): Promise<number> {
  return db.transactions.where('categoryId').equals(id).filter(transaction => transaction.deletedAt === null).count()
}

/** Soft delete, only for a category no transaction uses: otherwise CategoryInUseError. */
export async function deleteCategory(id: string): Promise<void> {
  await db.transaction('rw', db.categories, db.transactions, async () => {
    const count = await countCategoryTransactions(id)
    if (count > 0)
      throw new CategoryInUseError(id, count)
    const timestamp = now()
    await db.categories.update(id, { deletedAt: timestamp, updatedAt: timestamp })
  })
}

/** Undoes deleteCategory ("Annulla" in the notice). */
export async function restoreCategory(id: string): Promise<void> {
  await db.categories.update(id, {
    deletedAt: null,
    updatedAt: now(),
  })
}
