import { describe, expect, it } from 'vitest'
import { summarize } from './summary'

describe('summarize', () => {
  it('totals income and expenses, ignoring transfers', () => {
    const summary = summarize([
      { kind: 'income', amountCents: 245000, categoryId: 'salary' },
      { kind: 'expense', amountCents: 41280, categoryId: 'groceries' },
      { kind: 'expense', amountCents: 35000, categoryId: 'home' },
      { kind: 'expense', amountCents: 1200, categoryId: 'groceries' },
      { kind: 'transfer', amountCents: 50000, categoryId: null },
    ])
    expect(summary.incomeCents).toBe(245000)
    expect(summary.expenseCents).toBe(77480)
    expect(summary.balanceCents).toBe(167520)
  })

  it('splits expenses by category, largest first, with shares', () => {
    const { expenseByCategory } = summarize([
      { kind: 'expense', amountCents: 300, categoryId: 'b' },
      { kind: 'expense', amountCents: 100, categoryId: 'a' },
      { kind: 'expense', amountCents: 600, categoryId: 'c' },
      { kind: 'income', amountCents: 999, categoryId: 'salary' },
    ])
    expect(expenseByCategory).toEqual([
      { categoryId: 'c', cents: 600, share: 0.6 },
      { categoryId: 'b', cents: 300, share: 0.3 },
      { categoryId: 'a', cents: 100, share: 0.1 },
    ])
  })

  it('splits income by category too', () => {
    const { incomeByCategory } = summarize([
      { kind: 'income', amountCents: 150000, categoryId: 'salary' },
      { kind: 'income', amountCents: 50000, categoryId: 'refunds' },
      { kind: 'expense', amountCents: 999, categoryId: 'groceries' },
    ])
    expect(incomeByCategory).toEqual([
      { categoryId: 'salary', cents: 150000, share: 0.75 },
      { categoryId: 'refunds', cents: 50000, share: 0.25 },
    ])
  })

  it('is empty and balanced with no transactions', () => {
    expect(summarize([])).toEqual({
      incomeCents: 0,
      expenseCents: 0,
      balanceCents: 0,
      expenseByCategory: [],
      incomeByCategory: [],
    })
  })
})
