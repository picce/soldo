import type { BaseRecord, Category, CategoryKind } from '../schema'
import { db } from '../database'
import { newRecord } from '../records'

export interface CategoryQuery {
  kind?: CategoryKind
  /** Archived categories are hidden unless asked for (they stay in the history). */
  includeArchived?: boolean
}

/** Categories not deleted, in the user's order. */
export async function listCategories(query: CategoryQuery = {}): Promise<Category[]> {
  const { kind, includeArchived = false } = query
  const rows = await db.categories
    .filter(category =>
      category.deletedAt === null
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
