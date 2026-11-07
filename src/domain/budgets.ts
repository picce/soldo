import type { DateRange } from './periods'
import type { Budget, Transaction } from '@/db/schema'
import { addMonths, differenceInCalendarDays } from 'date-fns'
import { fromIsoDate, toIsoDate } from './dates'
import { periodRange } from './periods'

/**
 * Monthly budgets (docs/specs/budget-mensili.md): which budget is in force in a month, how much
 * was spent, and when a save takes a budget past 80% or over it. Months are `YYYY-MM`.
 */

/** A category id, or null for the total of the month. */
export type BudgetKey = string | null

export type BudgetLevel = 'ok' | 'near' | 'over'

type BudgetRecord = Pick<Budget, 'month' | 'categoryId' | 'amountCents' | 'repeat' | 'endMonth' | 'deletedAt'>
type SpendingRecord = Pick<Transaction, 'kind' | 'amountCents' | 'date' | 'categoryId' | 'deletedAt'>

export function isMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value)
}

export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function shiftMonth(month: string, steps: number): string {
  return monthOf(toIsoDate(addMonths(fromIsoDate(`${month}-01`), steps)))
}

export function monthRange(month: string): DateRange {
  return periodRange({ unit: 'month', anchor: `${month}-01` })
}

/** Whether a budget counts in `month`: its own month, or a later one while it repeats. */
function appliesTo(budget: BudgetRecord, month: string): boolean {
  if (budget.deletedAt !== null || budget.month > month)
    return false
  return budget.month === month || (budget.repeat && (!budget.endMonth || budget.endMonth >= month))
}

/** The budget of `key` in force in `month`: the most recent of those that apply to it. */
export function budgetInForce<T extends BudgetRecord>(budgets: T[], month: string, key: BudgetKey): T | undefined {
  let found: T | undefined
  for (const budget of budgets) {
    if (budget.categoryId === key && appliesTo(budget, month) && (!found || budget.month > found.month))
      found = budget
  }
  return found
}

/** Every budget in force in `month`, by key. */
export function budgetsInForce<T extends BudgetRecord>(budgets: T[], month: string): Map<BudgetKey, T> {
  const keys = new Set(budgets.map(budget => budget.categoryId))
  const result = new Map<BudgetKey, T>()
  for (const key of keys) {
    const budget = budgetInForce(budgets, month, key)
    if (budget)
      result.set(key, budget)
  }
  return result
}

export interface Spending {
  totalCents: number
  byCategory: Map<string, number>
}

/** Expenses of the month, future days included; income and transfers do not count. */
export function monthSpending(transactions: SpendingRecord[], month: string): Spending {
  const byCategory = new Map<string, number>()
  let totalCents = 0
  for (const { kind, amountCents, date, categoryId, deletedAt } of transactions) {
    if (kind !== 'expense' || deletedAt !== null || monthOf(date) !== month)
      continue
    totalCents += amountCents
    if (categoryId)
      byCategory.set(categoryId, (byCategory.get(categoryId) ?? 0) + amountCents)
  }
  return { totalCents, byCategory }
}

export function spentFor(spending: Spending, key: BudgetKey): number {
  return key === null
    ? spending.totalCents
    : spending.byCategory.get(key) ?? 0
}

/** Below 80%, from 80% to the whole budget included, or over it. */
export function budgetLevel(spentCents: number, budgetCents: number): BudgetLevel {
  if (spentCents > budgetCents)
    return 'over'
  return spentCents * 5 >= budgetCents * 4
    ? 'near'
    : 'ok'
}

const RANK: Record<BudgetLevel, number> = { ok: 0, near: 1, over: 2 }

/** The level a change reached, only when it is higher than before: each threshold warns once. */
export function crossedLevel(beforeCents: number, afterCents: number, budgetCents: number): Exclude<BudgetLevel, 'ok'> | null {
  const before = budgetLevel(beforeCents, budgetCents)
  const after = budgetLevel(afterCents, budgetCents)
  return after !== 'ok' && RANK[after] > RANK[before]
    ? after
    : null
}

/** Share of the budget spent, in whole percent rounded down. */
export function usedPercent(spentCents: number, budgetCents: number): number {
  return Math.floor(spentCents * 100 / budgetCents)
}

/** Days from `today` to the end of its month, today included; 0 for any other month. */
export function daysLeft(month: string, today: string): number {
  if (monthOf(today) !== month)
    return 0
  return differenceInCalendarDays(fromIsoDate(monthRange(month).to), fromIsoDate(today)) + 1
}

/** What can still be spent each day until the end of the current month; undefined otherwise. */
export function dailyAllowance(remainingCents: number, month: string, today: string): number | undefined {
  const days = daysLeft(month, today)
  return days > 0 && remainingCents > 0
    ? Math.floor(remainingCents / days)
    : undefined
}
