import type { Transaction } from '@/db/schema'

export interface CategoryTotal {
  categoryId: string
  cents: number
  /** Share of the period's expenses, from 0 to 1. */
  share: number
}

export interface Summary {
  incomeCents: number
  expenseCents: number
  /** Income minus expenses. */
  balanceCents: number
  /** Expenses per category, largest first. */
  expenseByCategory: CategoryTotal[]
}

/** Totals of a set of transactions. Transfers move money between accounts and do not count. */
export function summarize(transactions: Pick<Transaction, 'kind' | 'amountCents' | 'categoryId'>[]): Summary {
  let incomeCents = 0
  let expenseCents = 0
  const byCategory = new Map<string, number>()

  for (const { kind, amountCents, categoryId } of transactions) {
    if (kind === 'income') {
      incomeCents += amountCents
    }
    else if (kind === 'expense') {
      expenseCents += amountCents
      if (categoryId)
        byCategory.set(categoryId, (byCategory.get(categoryId) ?? 0) + amountCents)
    }
  }

  const expenseByCategory = [...byCategory]
    .map(([categoryId, cents]) => ({
      categoryId,
      cents,
      share: expenseCents
        ? cents / expenseCents
        : 0,
    }))
    .sort((a, b) => b.cents - a.cents || a.categoryId.localeCompare(b.categoryId))

  return {
    incomeCents,
    expenseCents,
    balanceCents: incomeCents - expenseCents,
    expenseByCategory,
  }
}
