import type { Transaction } from '@/db/schema'

export interface DayGroup<T> {
  /** Calendar date, `YYYY-MM-DD`. */
  date: string
  transactions: T[]
  /** Income minus expenses of the day, in cents. Transfers do not count. */
  totalCents: number
}

/** Signed amount of a transaction: negative for expenses, zero for transfers. */
export function signedCents(transaction: Pick<Transaction, 'kind' | 'amountCents'>): number {
  if (transaction.kind === 'expense')
    return -transaction.amountCents
  return transaction.kind === 'income'
    ? transaction.amountCents
    : 0
}

/** Groups transactions already sorted by date, keeping their order. */
export function groupByDay<T extends Pick<Transaction, 'date' | 'kind' | 'amountCents'>>(transactions: readonly T[]): DayGroup<T>[] {
  const groups: DayGroup<T>[] = []
  for (const transaction of transactions) {
    let group = groups.at(-1)
    if (group?.date !== transaction.date) {
      group = { date: transaction.date, transactions: [], totalCents: 0 }
      groups.push(group)
    }
    group.transactions.push(transaction)
    group.totalCents += signedCents(transaction)
  }
  return groups
}
