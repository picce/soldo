import type { CategoryTotal } from './summary'
import { describe, expect, it } from 'vitest'
import { groupCategoryShares, wholePercents } from './category-share'

function totals(...cents: number[]): CategoryTotal[] {
  const sum = cents.reduce((a, b) => a + b, 0)
  return cents.map((value, index) => ({ categoryId: `c${index + 1}`, cents: value, share: value / sum }))
}

describe('wholePercents', () => {
  it('adds up to 100', () => {
    expect(wholePercents([1, 1, 1])).toEqual([34, 33, 33])
    expect(wholePercents([41280, 35000, 18650, 14200, 9800, 9500])).toEqual([32, 27, 15, 11, 8, 7])
    expect(wholePercents([999, 1])).toEqual([100, 0])
  })

  it('gives zeros when there is nothing', () => {
    expect(wholePercents([0, 0])).toEqual([0, 0])
    expect(wholePercents([])).toEqual([])
  })
})

describe('groupCategoryShares', () => {
  it('keeps up to eight categories, largest first', () => {
    const entries = groupCategoryShares(totals(100, 300, 200))
    expect(entries.map(entry => entry.key)).toEqual(['c2', 'c3', 'c1'])
    expect(entries.map(entry => entry.percent)).toEqual([50, 33, 17])
    expect(groupCategoryShares(totals(8, 7, 6, 5, 4, 3, 2, 1))).toHaveLength(8)
  })

  it('groups the smallest into «other» beyond eight categories', () => {
    const entries = groupCategoryShares(totals(90, 80, 70, 60, 50, 40, 30, 20, 10))
    expect(entries).toHaveLength(8)
    expect(entries.at(-1)).toMatchObject({
      key: 'other',
      categoryIds: ['c8', 'c9'],
      cents: 30,
    })
    expect(entries.reduce((sum, entry) => sum + entry.percent, 0)).toBe(100)
    expect(entries.reduce((sum, entry) => sum + entry.share, 0)).toBeCloseTo(1)
  })

  it('keeps the same entries whatever the input order', () => {
    const forward = groupCategoryShares(totals(5, 5, 9))
    const backward = groupCategoryShares(totals(5, 5, 9).reverse())
    expect(backward).toEqual(forward)
  })
})
