import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../database'
import { setClock } from '../records'
import { getBudgetInForce, listBudgets, removeBudget, restoreBudgets, setBudget } from './budgets'

let tick = 0

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  tick = 0
  setClock(() => new Date(Date.UTC(2026, 10, 7, 8, 0, tick++)))
})

afterEach(() => setClock())

async function amountIn(month: string, categoryId: string | null = null) {
  return (await getBudgetInForce(month, categoryId))?.amountCents
}

describe('budgets', () => {
  it('changes the budget of a month instead of adding a second one', async () => {
    await setBudget({
      month: '2026-01',
      categoryId: null,
      amountCents: 100000,
      repeat: true,
    })
    await setBudget({
      month: '2026-01',
      categoryId: null,
      amountCents: 90000,
      repeat: true,
    })
    expect(await listBudgets()).toHaveLength(1)
    expect(await amountIn('2026-06')).toBe(90000)
  })

  it('refuses a broken month or amount', async () => {
    await expect(setBudget({
      month: '2026-13',
      categoryId: null,
      amountCents: 100,
      repeat: true,
    })).rejects.toThrow(RangeError)
    await expect(setBudget({
      month: '2026-01',
      categoryId: null,
      amountCents: 0,
      repeat: true,
    })).rejects.toThrow(RangeError)
  })

  it('sets one month only, and from a month on', async () => {
    await setBudget({
      month: '2026-01',
      categoryId: 'groceries',
      amountCents: 25000,
      repeat: true,
    })
    await setBudget({
      month: '2026-03',
      categoryId: 'groceries',
      amountCents: 30000,
      repeat: false,
    })
    expect(await amountIn('2026-03', 'groceries')).toBe(30000)
    expect(await amountIn('2026-04', 'groceries')).toBe(25000)

    await setBudget({
      month: '2026-03',
      categoryId: 'groceries',
      amountCents: 30000,
      repeat: true,
    })
    expect(await amountIn('2026-04', 'groceries')).toBe(30000)
    expect(await amountIn('2026-02', 'groceries')).toBe(25000)
  })

  it('takes a budget away from a month on, leaving the earlier ones', async () => {
    await setBudget({
      month: '2026-01',
      categoryId: null,
      amountCents: 100000,
      repeat: true,
    })
    await removeBudget('2026-03', null)
    expect(await amountIn('2026-02')).toBe(100000)
    expect(await amountIn('2026-03')).toBeUndefined()
    expect(await amountIn('2026-09')).toBeUndefined()
  })

  it('takes away a budget of one month along with the repeating one under it', async () => {
    await setBudget({
      month: '2026-01',
      categoryId: null,
      amountCents: 100000,
      repeat: true,
    })
    await setBudget({
      month: '2026-03',
      categoryId: null,
      amountCents: 30000,
      repeat: false,
    })
    await removeBudget('2026-03', null)
    expect(await amountIn('2026-03')).toBeUndefined()
    expect(await amountIn('2026-04')).toBeUndefined()
    expect(await amountIn('2026-01')).toBe(100000)
  })

  it('ends every older repeating budget, so none comes back', async () => {
    await setBudget({
      month: '2026-01',
      categoryId: null,
      amountCents: 100000,
      repeat: true,
    })
    await setBudget({
      month: '2026-03',
      categoryId: null,
      amountCents: 80000,
      repeat: true,
    })
    await removeBudget('2026-05', null)
    expect(await amountIn('2026-04')).toBe(80000)
    expect(await amountIn('2026-02')).toBe(100000)
    expect(await amountIn('2026-05')).toBeUndefined()
  })

  it('puts everything back with «Annulla»', async () => {
    await setBudget({
      month: '2026-01',
      categoryId: null,
      amountCents: 100000,
      repeat: true,
    })
    await setBudget({
      month: '2026-03',
      categoryId: null,
      amountCents: 30000,
      repeat: false,
    })
    const previous = await removeBudget('2026-03', null)
    await restoreBudgets(previous)
    expect(await amountIn('2026-03')).toBe(30000)
    expect(await amountIn('2026-04')).toBe(100000)
  })

  it('starts a budget set again after a removal', async () => {
    await setBudget({
      month: '2026-01',
      categoryId: null,
      amountCents: 100000,
      repeat: true,
    })
    await removeBudget('2026-03', null)
    await setBudget({
      month: '2026-06',
      categoryId: null,
      amountCents: 50000,
      repeat: true,
    })
    expect(await amountIn('2026-04')).toBeUndefined()
    expect(await amountIn('2026-08')).toBe(50000)
  })
})
