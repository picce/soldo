import type { Transaction } from '@/db/schema'
import type { BudgetKey } from '@/domain/budgets'
import { categoryName } from '@/db/names'
import { listBudgets } from '@/db/repositories/budgets'
import { getCategory } from '@/db/repositories/categories'
import { listTransactions } from '@/db/repositories/transactions'
import { budgetInForce, crossedLevel, monthOf, monthRange, monthSpending, spentFor, usedPercent } from '@/domain/budgets'
import { formatAmount } from '@/domain/money'
import { i18n } from '@/i18n'
import { intlLocale } from '@/i18n/locale'

async function spendingOf(month: string) {
  return monthSpending(await listTransactions(monthRange(month)), month)
}

interface Crossing {
  key: BudgetKey
  level: 'near' | 'over'
  spentCents: number
  budgetCents: number
}

async function warningText({ key, level, spentCents, budgetCents }: Crossing): Promise<string> {
  const category = key === null
    ? undefined
    : await getCategory(key)
  const values = {
    category: category
      ? categoryName(category)
      : '',
    percent: usedPercent(spentCents, budgetCents),
    amount: formatAmount(spentCents - budgetCents, intlLocale(), { currency: true }),
  }
  const scope = category
    ? 'category'
    : 'total'
  return i18n.global.t(`budgetWarning.${scope}${level === 'over'
    ? 'Over'
    : 'Near'}`, values)
}

/**
 * Runs `write`, which saves `transaction`, and says whether it took a budget of its month past 80%
 * or over it (docs/specs/budget-mensili.md, «Avvisi»): «Budget di Spesa: 82% usato.». Over counts
 * more than near, and the category more than the total. Only expenses are checked.
 */
export async function withBudgetCheck<T>(
  transaction: Pick<Transaction, 'kind' | 'date' | 'categoryId'>,
  write: () => Promise<T>,
): Promise<{ result: T, warning?: string }> {
  if (transaction.kind !== 'expense')
    return { result: await write() }
  const month = monthOf(transaction.date)
  const before = await spendingOf(month)
  const result = await write()
  const [after, budgets] = await Promise.all([
    spendingOf(month),
    listBudgets(),
  ])
  const keys: BudgetKey[] = transaction.categoryId
    ? [transaction.categoryId, null]
    : [null]
  let found: Crossing | undefined
  for (const key of keys) {
    const budget = budgetInForce(budgets, month, key)
    if (!budget)
      continue
    const level = crossedLevel(spentFor(before, key), spentFor(after, key), budget.amountCents)
    if (level && (!found || (level === 'over' && found.level === 'near'))) {
      found = {
        key,
        level,
        spentCents: spentFor(after, key),
        budgetCents: budget.amountCents,
      }
    }
  }
  return found
    ? { result, warning: await warningText(found) }
    : { result }
}
