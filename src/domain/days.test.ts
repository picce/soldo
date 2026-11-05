import { describe, expect, it } from 'vitest'
import { groupByDay, signedCents } from './days'

describe('groupByDay', () => {
  it('groups by date in the given order, with the total of each day', () => {
    const groups = groupByDay([
      { date: '2026-11-05', kind: 'expense', amountCents: 1240 },
      { date: '2026-11-05', kind: 'expense', amountCents: 1190 },
      { date: '2026-11-04', kind: 'income', amountCents: 5000 },
      { date: '2026-11-04', kind: 'transfer', amountCents: 9999 },
      { date: '2026-11-04', kind: 'expense', amountCents: 860 },
    ] as const)
    expect(groups.map(group => [group.date, group.transactions.length, group.totalCents])).toEqual([
      ['2026-11-05', 2, -2430],
      ['2026-11-04', 3, 4140],
    ])
  })

  it('signs expenses and ignores transfers', () => {
    expect(signedCents({ kind: 'expense', amountCents: 100 })).toBe(-100)
    expect(signedCents({ kind: 'income', amountCents: 100 })).toBe(100)
    expect(signedCents({ kind: 'transfer', amountCents: 100 })).toBe(0)
  })
})
