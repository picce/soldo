import type { Budget, Transaction } from '@/db/schema'
import { describe, expect, it } from 'vitest'
import {
  budgetInForce,
  budgetLevel,
  budgetsInForce,
  crossedLevel,
  dailyAllowance,
  daysLeft,
  isMonth,
  monthRange,
  monthSpending,
  shiftMonth,
  usedPercent,
} from './budgets'

function budget(month: string, amountCents: number, overrides: Partial<Budget> = {}): Budget {
  return {
    id: `${month}-${overrides.categoryId ?? 'total'}`,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    month,
    categoryId: null,
    amountCents,
    repeat: true,
    ...overrides,
  }
}

describe('months', () => {
  it('checks, moves and spans a month', () => {
    expect(isMonth('2026-11')).toBe(true)
    expect(isMonth('2026-13')).toBe(false)
    expect(isMonth('2026-1')).toBe(false)
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-03', -1)).toBe('2026-02')
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })
})

describe('budgetInForce', () => {
  const january = budget('2026-01', 1000)

  it('repeats a budget into the following months, not the earlier ones', () => {
    expect(budgetInForce([january], '2026-04', null)).toBe(january)
    expect(budgetInForce([january], '2025-12', null)).toBeUndefined()
  })

  it('keeps a budget of one month to that month', () => {
    const march = budget('2026-03', 300, { repeat: false })
    const budgets = [january, march]
    expect(budgetInForce(budgets, '2026-02', null)).toBe(january)
    expect(budgetInForce(budgets, '2026-03', null)).toBe(march)
    expect(budgetInForce(budgets, '2026-04', null)).toBe(january)
    expect(budgetInForce([march], '2026-04', null)).toBeUndefined()
  })

  it('lets a later repeating budget take over', () => {
    const march = budget('2026-03', 300)
    expect(budgetInForce([january, march], '2026-02', null)).toBe(january)
    expect(budgetInForce([january, march], '2026-06', null)).toBe(march)
  })

  it('stops a repeating budget after its last month, and ignores deleted ones', () => {
    const ended = budget('2026-01', 1000, { endMonth: '2026-02' })
    expect(budgetInForce([ended], '2026-02', null)).toBe(ended)
    expect(budgetInForce([ended], '2026-03', null)).toBeUndefined()
    expect(budgetInForce([
      budget('2026-01', 1000, { deletedAt: 'x' }),
    ], '2026-01', null)).toBeUndefined()
  })

  it('keeps the total and each category apart', () => {
    const groceries = budget('2026-01', 250, { categoryId: 'groceries' })
    const inForce = budgetsInForce([january, groceries], '2026-05')
    expect(inForce.get(null)).toBe(january)
    expect(inForce.get('groceries')).toBe(groceries)
    expect(budgetInForce([groceries], '2026-05', null)).toBeUndefined()
  })
})

describe('monthSpending', () => {
  const row = (overrides: Partial<Transaction>) => ({
    kind: 'expense',
    amountCents: 100,
    date: '2026-11-05',
    categoryId: 'groceries',
    deletedAt: null,
    ...overrides,
  }) as Transaction

  it('counts the expenses of the month only, future days included', () => {
    const spending = monthSpending([
      row({}),
      row({ date: '2026-11-30', categoryId: 'home', amountCents: 300 }),
      row({ kind: 'income', amountCents: 5000 }),
      row({ kind: 'transfer', amountCents: 7000, categoryId: null }),
      row({ deletedAt: 'x' }),
      row({ date: '2026-10-31' }),
    ], '2026-11')
    expect(spending.totalCents).toBe(400)
    expect(spending.byCategory.get('groceries')).toBe(100)
    expect(spending.byCategory.get('home')).toBe(300)
  })
})

describe('levels', () => {
  it('splits at 80% and over the budget, the whole budget still near', () => {
    expect(budgetLevel(799, 1000)).toBe('ok')
    expect(budgetLevel(800, 1000)).toBe('near')
    expect(budgetLevel(1000, 1000)).toBe('near')
    expect(budgetLevel(1001, 1000)).toBe('over')
  })

  it('warns once per threshold, and for the highest when it jumps', () => {
    expect(crossedLevel(700, 850, 1000)).toBe('near')
    expect(crossedLevel(850, 900, 1000)).toBeNull()
    expect(crossedLevel(900, 1100, 1000)).toBe('over')
    expect(crossedLevel(100, 1100, 1000)).toBe('over')
    expect(crossedLevel(1100, 1200, 1000)).toBeNull()
    expect(crossedLevel(900, 100, 1000)).toBeNull()
  })

  it('rounds the percentage down', () => {
    expect(usedPercent(799, 1000)).toBe(79)
    expect(usedPercent(1215, 1000)).toBe(121)
  })
})

describe('what is left each day', () => {
  it('counts today, only in the current month', () => {
    expect(daysLeft('2026-11', '2026-11-07')).toBe(24)
    expect(daysLeft('2026-11', '2026-11-30')).toBe(1)
    expect(daysLeft('2026-10', '2026-11-07')).toBe(0)
  })

  it('divides what is left by the days, and says nothing when nothing is left', () => {
    expect(dailyAllowance(32000, '2026-11', '2026-11-07')).toBe(1333)
    expect(dailyAllowance(0, '2026-11', '2026-11-07')).toBeUndefined()
    expect(dailyAllowance(32000, '2026-10', '2026-11-07')).toBeUndefined()
  })
})
