import type { Budget } from '../schema'
import { budgetInForce, isMonth, shiftMonth } from '@/domain/budgets'
import { isValidAmountCents } from '@/domain/money'
import { db } from '../database'
import { newRecord, now } from '../records'

/** What the user chooses for a budget (docs/specs/budget-mensili.md). */
export interface BudgetInput {
  /** `YYYY-MM`: the month it starts from. */
  month: string
  /** Null for the total of the month. */
  categoryId: string | null
  amountCents: number
  /** Whether it goes on in the following months. */
  repeat: boolean
}

/** Budgets not deleted. */
export async function listBudgets(): Promise<Budget[]> {
  return db.budgets.filter(budget => budget.deletedAt === null).toArray()
}

async function budgetsOf(categoryId: string | null): Promise<Budget[]> {
  return db.budgets
    .filter(budget => budget.deletedAt === null && budget.categoryId === categoryId)
    .toArray()
}

/** Sets the budget of a month: it changes the one of that month, or adds it. */
export async function setBudget(input: BudgetInput): Promise<Budget> {
  if (!isMonth(input.month))
    throw new RangeError(`Invalid month: ${input.month}`)
  if (!isValidAmountCents(input.amountCents))
    throw new RangeError(`Invalid amount: ${input.amountCents}`)
  return db.transaction('rw', db.budgets, async () => {
    const existing = (await budgetsOf(input.categoryId)).find(budget => budget.month === input.month)
    if (existing) {
      const changes = {
        amountCents: input.amountCents,
        repeat: input.repeat,
        endMonth: undefined,
        updatedAt: now(),
      }
      await db.budgets.update(existing.id, changes)
      const { endMonth: _, ...rest } = {
        ...existing,
        ...changes,
      }
      return rest
    }
    const budget: Budget = {
      ...newRecord(),
      month: input.month,
      categoryId: input.categoryId,
      amountCents: input.amountCents,
      repeat: input.repeat,
    }
    await db.budgets.add(budget)
    return budget
  })
}

/**
 * Takes the budget away from `month` on: the one of that month goes, and older repeating ones that
 * would still apply end the month before. Earlier months do not change. Returns the budgets as
 * they were, for `restoreBudgets` («Annulla»).
 */
export async function removeBudget(month: string, categoryId: string | null): Promise<Budget[]> {
  return db.transaction('rw', db.budgets, async () => {
    const budgets = await budgetsOf(categoryId)
    const previous: Budget[] = []
    const timestamp = now()
    for (const budget of budgets) {
      if (budget.month === month) {
        previous.push(budget)
        await db.budgets.update(budget.id, { deletedAt: timestamp, updatedAt: timestamp })
      }
      else if (budget.month < month && budget.repeat && (!budget.endMonth || budget.endMonth >= month)) {
        previous.push(budget)
        await db.budgets.update(budget.id, {
          endMonth: shiftMonth(month, -1),
          updatedAt: timestamp,
        })
      }
    }
    return previous
  })
}

/** Puts back budgets as `removeBudget` found them. */
export async function restoreBudgets(budgets: Budget[]): Promise<void> {
  await db.budgets.bulkPut(budgets)
}

/** The budget of `categoryId` in force in `month`, if any. */
export async function getBudgetInForce(month: string, categoryId: string | null): Promise<Budget | undefined> {
  return budgetInForce(await budgetsOf(categoryId), month, categoryId)
}
