import type { Transaction } from '@/db/schema'
import { describe, expect, it } from 'vitest'
import {
  average,
  categoryChanges,
  categoryTrend,
  change,
  countedRange,
  cumulativeByDay,
  daysIn,
  monthByMonth,
  monthsIn,
  niceStep,
  previousRange,
  shiftStatsPeriod,
  statsPeriodOf,
  statsRange,
  totals,
} from './stats'

type Row = Pick<Transaction, 'kind' | 'amountCents' | 'categoryId' | 'date'>

function expense(date: string, amountCents: number, categoryId = 'food'): Row {
  return {
    kind: 'expense',
    amountCents,
    categoryId,
    date,
  }
}
function income(date: string, amountCents: number, categoryId = 'salary'): Row {
  return {
    kind: 'income',
    amountCents,
    categoryId,
    date,
  }
}
function transfer(date: string, amountCents: number): Row {
  return {
    kind: 'transfer',
    amountCents,
    categoryId: null,
    date,
  }
}

const november = { unit: 'month', key: '2026-11' } as const
const year = { unit: 'year', key: '2026' } as const

describe('periods', () => {
  it('spans a month or a year, and moves by one', () => {
    expect(statsRange(november)).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(statsRange(year)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(shiftStatsPeriod(november, 2)).toEqual({ unit: 'month', key: '2027-01' })
    expect(shiftStatsPeriod(year, -1)).toEqual({ unit: 'year', key: '2025' })
    expect(statsPeriodOf('year', '2026-11-07')).toEqual(year)
  })

  it('counts the current period up to today, and a past one whole', () => {
    expect(countedRange(november, '2026-11-07')).toEqual({ from: '2026-11-01', to: '2026-11-07' })
    expect(countedRange(november, '2026-12-03')).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(countedRange(year, '2026-11-07')).toEqual({ from: '2026-01-01', to: '2026-11-07' })
  })

  it('compares the current period with the one before at the same point', () => {
    expect(previousRange(november, '2026-11-07')).toEqual({ from: '2026-10-01', to: '2026-10-07' })
    expect(previousRange({ unit: 'month', key: '2027-03' }, '2027-03-31')).toEqual({ from: '2027-02-01', to: '2027-02-28' })
    expect(previousRange({ unit: 'month', key: '2027-01' }, '2027-01-15')).toEqual({ from: '2026-12-01', to: '2026-12-15' })
    expect(previousRange(year, '2026-11-07')).toEqual({ from: '2025-01-01', to: '2025-11-07' })
    expect(previousRange({ unit: 'year', key: '2028' }, '2028-02-29')).toEqual({ from: '2027-01-01', to: '2027-02-28' })
  })

  it('compares a past period whole', () => {
    expect(previousRange({ unit: 'month', key: '2026-10' }, '2026-11-07')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('counts days and months', () => {
    expect(daysIn({ from: '2026-11-01', to: '2026-11-07' })).toBe(7)
    expect(monthsIn({ from: '2026-01-01', to: '2026-11-07' })).toBe(11)
    expect(average(31240, 7)).toBe(4463)
    expect(average(100, 0)).toBe(0)
  })
})

describe('totals and changes', () => {
  const rows = [
    expense('2026-11-02', 1000),
    income('2026-11-01', 5000),
    transfer('2026-11-03', 9999),
    expense('2026-10-31', 700),
  ]

  it('adds income and expenses in a range, without transfers', () => {
    expect(totals(rows, statsRange(november))).toEqual({ incomeCents: 5000, expenseCents: 1000 })
  })

  it('says how much and by what share it changed', () => {
    expect(change(31240, 27890)).toEqual({ deltaCents: 3350, percent: 12 })
    expect(change(500, 0)).toEqual({ deltaCents: 500, percent: null })
    expect(change(0, 400)).toEqual({ deltaCents: -400, percent: -100 })
  })
})

describe('cumulativeByDay', () => {
  const rows = [
    expense('2026-11-01', 1240),
    expense('2026-11-02', 4580),
    income('2026-11-02', 9000),
    expense('2026-11-05', 1000),
    expense('2026-11-20', 500),
  ]

  it('sums the expenses day by day up to today', () => {
    expect(cumulativeByDay(rows, '2026-11', '2026-11-05')).toEqual([1240, 5820, 5820, 5820, 6820])
  })

  it('runs through the whole month when today is elsewhere', () => {
    const days = cumulativeByDay(rows, '2026-11', '2026-12-01')
    expect(days).toHaveLength(30)
    expect(days.at(-1)).toBe(7320)
  })
})

describe('monthByMonth', () => {
  it('gives income and expenses of each month', () => {
    const months = monthByMonth([
      expense('2026-01-10', 100),
      income('2026-01-27', 2000),
      expense('2026-07-02', 300),
      transfer('2026-07-03', 50),
    ], '2026')
    expect(months).toHaveLength(12)
    expect(months[0]).toEqual({ month: '2026-01', incomeCents: 2000, expenseCents: 100 })
    expect(months[6]).toEqual({ month: '2026-07', incomeCents: 0, expenseCents: 300 })
    expect(months[11]).toEqual({ month: '2026-12', incomeCents: 0, expenseCents: 0 })
  })
})

describe('categoryChanges', () => {
  it('lists the categories of the period, largest first, with the period before', () => {
    const rows = [
      expense('2026-11-02', 12840, 'food'),
      expense('2026-11-03', 8600, 'eating-out'),
      expense('2026-10-02', 11020, 'food'),
      expense('2026-10-20', 9999, 'food'),
      expense('2026-10-05', 3000, 'gone'),
      income('2026-11-01', 185000),
    ]
    expect(categoryChanges(rows, 'expense', countedRange(november, '2026-11-07'), previousRange(november, '2026-11-07'))).toEqual([
      {
        categoryId: 'food',
        cents: 12840,
        previousCents: 11020,
        deltaCents: 1820,
        percent: 17,
      },
      {
        categoryId: 'eating-out',
        cents: 8600,
        previousCents: 0,
        deltaCents: 8600,
        percent: null,
      },
    ])
  })
})

describe('categoryTrend', () => {
  it('gives 12 months, and the average of the finished ones since the first transaction', () => {
    const rows = [
      expense('2026-08-10', 30000),
      expense('2026-09-03', 20000),
      expense('2026-10-21', 40000),
      expense('2026-11-02', 5000),
    ]
    const trend = categoryTrend(rows, '2026-11', '2026-11-07')
    expect(trend.months).toHaveLength(12)
    expect(trend.months[0]).toEqual({ month: '2025-12', cents: 0 })
    expect(trend.months.at(-1)).toEqual({ month: '2026-11', cents: 5000 })
    expect(trend.averageCents).toBe(30000)
  })

  it('has no average without a finished month', () => {
    expect(categoryTrend([
      expense('2026-11-02', 5000),
    ], '2026-11', '2026-11-07').averageCents).toBeNull()
    expect(categoryTrend([], '2026-11', '2026-11-07').averageCents).toBeNull()
  })
})

it('picks round steps for an axis', () => {
  expect(niceStep(126430)).toBe(50000)
  expect(niceStep(350000)).toBe(200000)
  expect(niceStep(32260)).toBe(20000)
  expect(niceStep(0)).toBe(1)
})
