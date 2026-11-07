import type { BaseRecord, Transaction, TransactionKind } from '../schema'
import { isIsoDate } from '@/domain/dates'
import { isValidAmountCents } from '@/domain/money'
import { db } from '../database'
import { newRecord, now } from '../records'
import { DEFAULT_CURRENCY } from '../schema'

type TransactionFields = Omit<Transaction, keyof BaseRecord>

/** A new transaction: currency and source have defaults (EUR, manual). */
export type NewTransaction = Omit<TransactionFields, 'currency' | 'source'> & Partial<Pick<TransactionFields, 'currency' | 'source'>>

export interface TransactionQuery {
  /** Inclusive range of calendar dates. */
  from?: string
  to?: string
  kinds?: TransactionKind[]
  categoryIds?: string[]
  /** Transactions of the account, transfers from and to it included. */
  accountId?: string
}

function validate(fields: Partial<TransactionFields>) {
  if (fields.amountCents !== undefined && !isValidAmountCents(fields.amountCents))
    throw new RangeError(`Invalid amount: ${fields.amountCents}`)
  if (fields.date !== undefined && !isIsoDate(fields.date))
    throw new RangeError(`Invalid date: ${fields.date}`)
}

/**
 * What each kind may hold: only transfers have a destination, only expenses a payment method.
 * The template of a recurrence passes the same checks.
 */
export function validateKind({ kind, accountId, toAccountId, categoryId, paymentMethodId }: Pick<TransactionFields, 'kind' | 'accountId' | 'toAccountId' | 'categoryId' | 'paymentMethodId'>) {
  if (kind === 'transfer') {
    if (!toAccountId || toAccountId === accountId)
      throw new RangeError('A transfer needs two different accounts')
    if (categoryId !== null)
      throw new RangeError('A transfer has no category')
  }
  else if (toAccountId) {
    throw new RangeError('Only a transfer has a destination account')
  }
  if (paymentMethodId && kind !== 'expense')
    throw new RangeError('Only an expense has a payment method')
}

export async function addTransaction(input: NewTransaction): Promise<Transaction> {
  validate(input)
  const transaction: Transaction = {
    ...newRecord(),
    currency: DEFAULT_CURRENCY,
    source: 'manual',
    ...input,
  }
  validateKind(transaction)
  await db.transactions.add(transaction)
  return transaction
}

/** The transaction, unless it does not exist or was deleted. */
export async function getTransaction(id: string): Promise<Transaction | undefined> {
  const transaction = await db.transactions.get(id)
  return transaction?.deletedAt === null
    ? transaction
    : undefined
}

export async function updateTransaction(id: string, changes: Partial<TransactionFields>): Promise<void> {
  validate(changes)
  await db.transaction('rw', db.transactions, async () => {
    const current = await db.transactions.get(id)
    if (current) {
      validateKind({
        ...current,
        ...changes,
      })
    }
    await db.transactions.update(id, {
      ...changes,
      updatedAt: now(),
    })
  })
}

/** Soft delete: the row stays with `deletedAt`, so it can be restored ("Annulla" in the notice). */
export async function deleteTransaction(id: string): Promise<void> {
  const timestamp = now()
  await db.transactions.update(id, { deletedAt: timestamp, updatedAt: timestamp })
}

export async function restoreTransaction(id: string): Promise<void> {
  await db.transactions.update(id, {
    deletedAt: null,
    updatedAt: now(),
  })
}

/** Copy of a transaction on another date (the swipe to the right in Transactions). */
export async function duplicateTransaction(id: string, date: string): Promise<Transaction> {
  const original = await getTransaction(id)
  if (!original)
    throw new Error(`Transaction not found: ${id}`)
  const { kind, amountCents, currency, accountId, toAccountId, paymentMethodId, categoryId, note } = original
  return addTransaction({
    kind,
    amountCents,
    currency,
    date,
    accountId,
    toAccountId,
    paymentMethodId,
    categoryId,
    note,
  })
}

/** Transactions not deleted, newest first (by date, then by creation). */
/** Whether any transaction is left: the Statistics explain themselves when there is none. */
export async function hasTransactions(): Promise<boolean> {
  return !!(await db.transactions.filter(transaction => transaction.deletedAt === null).first())
}

export async function listTransactions(query: TransactionQuery = {}): Promise<Transaction[]> {
  const { from, to, kinds, categoryIds, accountId } = query
  const collection = from || to
    ? db.transactions.where('date').between(from ?? '0000-01-01', to ?? '9999-12-31', true, true)
    : db.transactions.toCollection()
  const rows = await collection
    .filter(transaction =>
      transaction.deletedAt === null
      && (!kinds || kinds.includes(transaction.kind))
      && (!categoryIds || (transaction.categoryId !== null && categoryIds.includes(transaction.categoryId)))
      && (!accountId || transaction.accountId === accountId || transaction.toAccountId === accountId),
    )
    .toArray()
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}
