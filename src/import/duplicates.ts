import type { IsoDate } from '@/domain/dates'
import { fromIsoDate } from '@/domain/dates'

/**
 * Movements of the statement that may already be in Soldo, typed by hand
 * (docs/specs/released/import-da-file.md): same kind and amount, at most 3 days apart. Each one
 * pairs with at most one row, the nearest by date.
 */

export const DUPLICATE_DAYS = 3

export interface DuplicateRow {
  key: string
  date: IsoDate
  /** With its sign, as read. */
  amountCents: number
}

export interface DuplicateCandidate {
  id: string
  kind: 'expense' | 'income' | 'transfer'
  date: IsoDate
  amountCents: number
}

function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round(Math.abs(fromIsoDate(a).getTime() - fromIsoDate(b).getTime()) / 86_400_000)
}

/** Row key → id of the transaction it may duplicate. */
export function findPossibleDuplicates(rows: readonly DuplicateRow[], candidates: readonly DuplicateCandidate[]): Map<string, string> {
  const pairs: { key: string, id: string, days: number }[] = []
  for (const row of rows) {
    const kind = row.amountCents < 0
      ? 'expense'
      : 'income'
    for (const candidate of candidates) {
      if (candidate.kind !== kind || candidate.amountCents !== Math.abs(row.amountCents))
        continue
      const days = daysBetween(row.date, candidate.date)
      if (days <= DUPLICATE_DAYS)
        pairs.push({ key: row.key, id: candidate.id, days })
    }
  }
  pairs.sort((a, b) => a.days - b.days)
  const result = new Map<string, string>()
  const taken = new Set<string>()
  for (const pair of pairs) {
    if (result.has(pair.key) || taken.has(pair.id))
      continue
    result.set(pair.key, pair.id)
    taken.add(pair.id)
  }
  return result
}
