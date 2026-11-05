import type { CategoryTotal } from './summary'

/** At most this many categories get their own segment; the rest go into «Altre». */
export const MAX_CATEGORY_SEGMENTS = 7

export interface CategoryShare {
  /** The category id, or `other` for the group of the smallest ones. */
  key: string
  /** Categories in this entry: one, or several for `other`. */
  categoryIds: string[]
  cents: number
  /** Share of the period's expenses, from 0 to 1. */
  share: number
  /** Whole percentage; all of them add up to 100. */
  percent: number
}

/**
 * Whole percentages that add up to 100 (largest remainder method): with plain rounding
 * 33,3 + 33,3 + 33,3 would show 99%.
 */
export function wholePercents(shares: number[]): number[] {
  const total = shares.reduce((sum, share) => sum + share, 0)
  if (!total)
    return shares.map(() => 0)
  const exact = shares.map(share => (share / total) * 100)
  const result = exact.map(Math.floor)
  let missing = 100 - result.reduce((sum, value) => sum + value, 0)
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (const { index } of byRemainder) {
    if (missing <= 0)
      break
    result[index]! += 1
    missing--
  }
  return result
}

/**
 * Entries of the category bar and rows of the Home, largest first. With more than eight
 * categories, the first seven stay and the others become one «Altre» entry: a group of a
 * single category would only hide its name. Each category keeps its own color, which
 * follows the category and never its rank.
 */
export function groupCategoryShares(totals: CategoryTotal[]): CategoryShare[] {
  const sorted = [...totals].sort((a, b) => b.cents - a.cents || a.categoryId.localeCompare(b.categoryId))
  const visible = sorted.length > MAX_CATEGORY_SEGMENTS + 1
    ? sorted.slice(0, MAX_CATEGORY_SEGMENTS)
    : sorted
  const rest = sorted.slice(visible.length)

  const entries = visible.map(total => ({
    key: total.categoryId,
    categoryIds: [total.categoryId],
    cents: total.cents,
  }))
  if (rest.length) {
    entries.push({
      key: 'other',
      categoryIds: rest.map(total => total.categoryId),
      cents: rest.reduce((sum, total) => sum + total.cents, 0),
    })
  }

  const totalCents = entries.reduce((sum, entry) => sum + entry.cents, 0)
  const percents = wholePercents(entries.map(entry => entry.cents))
  return entries.map((entry, index) => ({
    ...entry,
    share: totalCents
      ? entry.cents / totalCents
      : 0,
    percent: percents[index] ?? 0,
  }))
}
