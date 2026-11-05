import type { Transaction } from '@/db/schema'

export interface CategoryTotal {
  categoryId: string
  cents: number
  /** Share of the period's expenses (or income), from 0 to 1. */
  share: number
}

export interface Summary {
  incomeCents: number
  expenseCents: number
  /** Income minus expenses. */
  balanceCents: number
  /** Expenses per category, largest first. */
  expenseByCategory: CategoryTotal[]
  /** Income per category, largest first. */
  incomeByCategory: CategoryTotal[]
}

/** Totals per category, largest first (by id on a tie, so the order is stable). */
function byCategory(totals: Map<string, number>, sum: number): CategoryTotal[] {
  return [...totals]
    .map(([categoryId, cents]) => ({
      categoryId,
      cents,
      share: sum
        ? cents / sum
        : 0,
    }))
    .sort((a, b) => b.cents - a.cents || a.categoryId.localeCompare(b.categoryId))
}

/** Totals of a set of transactions. Transfers move money between accounts and do not count. */
export function summarize(transactions: Pick<Transaction, 'kind' | 'amountCents' | 'categoryId'>[]): Summary {
  let incomeCents = 0
  let expenseCents = 0
  const expenses = new Map<string, number>()
  const income = new Map<string, number>()

  for (const { kind, amountCents, categoryId } of transactions) {
    if (kind === 'transfer')
      continue
    if (kind === 'income')
      incomeCents += amountCents
    else
      expenseCents += amountCents
    const totals = kind === 'income'
      ? income
      : expenses
    if (categoryId)
      totals.set(categoryId, (totals.get(categoryId) ?? 0) + amountCents)
  }

  return {
    incomeCents,
    expenseCents,
    balanceCents: incomeCents - expenseCents,
    expenseByCategory: byCategory(expenses, expenseCents),
    incomeByCategory: byCategory(income, incomeCents),
  }
}
