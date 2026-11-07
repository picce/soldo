import type { PaymentMethod } from '../schema'
import { db } from '../database'
import { paymentMethodName } from '../names'
import { newRecord, now } from '../records'
import { countRecurrenceUses } from './recurrences'

export interface PaymentMethodQuery {
  /** Archived methods are hidden unless asked for (they stay in the history). */
  includeArchived?: boolean
}

/** Longest payment method name, in characters. */
export const MAX_PAYMENT_METHOD_NAME = 24

/** What the user chooses for a payment method: the rest (order, archived) is managed here. */
export interface PaymentMethodInput {
  name: string
  icon: string
  accountId: string
}

export type PaymentMethodChanges = Partial<PaymentMethodInput>

/** Refusal to delete a payment method that some expenses still use: archive it instead. */
export class PaymentMethodInUseError extends Error {
  constructor(readonly methodId: string, readonly count: number) {
    super(`Payment method ${methodId} is used by ${count} transactions`)
    this.name = 'PaymentMethodInUseError'
  }
}

/** Refusal to leave no active payment method: an expense would have nothing to start from. */
export class LastPaymentMethodError extends Error {
  constructor(readonly methodId: string) {
    super(`Payment method ${methodId} is the last active one`)
    this.name = 'LastPaymentMethodError'
  }
}

function validName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (!trimmed || trimmed.length > MAX_PAYMENT_METHOD_NAME)
    throw new RangeError(`Invalid payment method name: "${name}"`)
  return trimmed
}

/** Payment methods not deleted, in the user's order; archived ones only if asked for. */
export async function listPaymentMethods(query: PaymentMethodQuery = {}): Promise<PaymentMethod[]> {
  const { includeArchived = false } = query
  const rows = await db.paymentMethods
    .filter(method => method.deletedAt === null && (includeArchived || !method.archived))
    .toArray()
  return rows.sort((a, b) => a.order - b.order)
}

export async function getPaymentMethod(id: string): Promise<PaymentMethod | undefined> {
  const method = await db.paymentMethods.get(id)
  return method?.deletedAt === null
    ? method
    : undefined
}

async function nextOrder(): Promise<number> {
  const rows = await listPaymentMethods({ includeArchived: true })
  return rows.reduce((next, method) => Math.max(next, method.order + 1), 0)
}

/** A payment method chosen by the user, at the end of the list. */
export async function createPaymentMethod(input: PaymentMethodInput): Promise<PaymentMethod> {
  const name = validName(input.name)
  return db.transaction('rw', db.paymentMethods, async () => {
    const method: PaymentMethod = {
      ...newRecord(),
      name,
      icon: input.icon,
      accountId: input.accountId,
      order: await nextOrder(),
      archived: false,
    }
    await db.paymentMethods.add(method)
    return method
  })
}

/**
 * Changes a payment method. The expenses already saved stay on their account: only the next ones
 * follow a new `accountId`.
 */
export async function updatePaymentMethod(id: string, changes: PaymentMethodChanges): Promise<void> {
  const method = await getPaymentMethod(id)
  if (!method)
    throw new Error(`Payment method not found: ${id}`)
  const { name, ...rest } = changes
  const update: Partial<PaymentMethod> = {
    ...rest,
    updatedAt: now(),
  }
  if (name !== undefined) {
    const trimmed = validName(name)
    update.name = method.preset && trimmed === paymentMethodName({ preset: method.preset })
      ? undefined
      : trimmed
  }
  await db.paymentMethods.update(id, update)
}

/** Saves the order of the list: `ids` from first to last. Only moved rows change. */
export async function reorderPaymentMethods(ids: string[]): Promise<void> {
  const timestamp = now()
  await db.transaction('rw', db.paymentMethods, async () => {
    const rows = await db.paymentMethods.bulkGet(ids)
    await Promise.all(rows.map((method, order) => method && method.order !== order
      ? db.paymentMethods.update(method.id, { order, updatedAt: timestamp })
      : undefined))
  })
}

/** Throws unless another active payment method would remain. */
async function assertNotLast(id: string) {
  const others = (await listPaymentMethods()).filter(method => method.id !== id)
  if (!others.length)
    throw new LastPaymentMethodError(id)
}

/** Hides the payment method from the choices; its expenses keep it. */
export async function archivePaymentMethod(id: string): Promise<void> {
  await db.transaction('rw', db.paymentMethods, async () => {
    await assertNotLast(id)
    await db.paymentMethods.update(id, {
      archived: true,
      updatedAt: now(),
    })
  })
}

/** Brings an archived payment method back: at `order` (undo) or at the end of the list. */
export async function unarchivePaymentMethod(id: string, order?: number): Promise<void> {
  await db.transaction('rw', db.paymentMethods, async () => {
    if (!(await getPaymentMethod(id)))
      return
    await db.paymentMethods.update(id, {
      archived: false,
      order: order ?? await nextOrder(),
      updatedAt: now(),
    })
  })
}

/** Expenses (not deleted) paid this way. */
export async function countPaymentMethodTransactions(id: string): Promise<number> {
  return db.transactions
    .filter(transaction => transaction.deletedAt === null && transaction.paymentMethodId === id)
    .count()
}

/** Soft delete, only for a payment method no expense or series uses: otherwise PaymentMethodInUseError. */
export async function deletePaymentMethod(id: string): Promise<void> {
  await db.transaction('rw', db.paymentMethods, db.transactions, db.recurrences, async () => {
    const count = await countPaymentMethodTransactions(id) + await countRecurrenceUses({ paymentMethodId: id })
    if (count > 0)
      throw new PaymentMethodInUseError(id, count)
    await assertNotLast(id)
    const timestamp = now()
    await db.paymentMethods.update(id, { deletedAt: timestamp, updatedAt: timestamp })
  })
}

/** Undoes deletePaymentMethod ("Annulla" in the notice). */
export async function restorePaymentMethod(id: string): Promise<void> {
  await db.paymentMethods.update(id, {
    deletedAt: null,
    updatedAt: now(),
  })
}

/**
 * The active payment method of the expense touched most recently: going through the transactions
 * from the latest change, it stops at the first match. With `accountId`, only among the methods
 * of that account. Editing an old expense counts as using its method.
 */
export async function lastUsedPaymentMethod(accountId?: string): Promise<PaymentMethod | undefined> {
  const active = new Map((await listPaymentMethods()).map(method => [method.id, method]))
  const matches = (id: string | undefined) => {
    const method = id
      ? active.get(id)
      : undefined
    return !!method && (!accountId || method.accountId === accountId)
  }
  const transaction = await db.transactions
    .orderBy('updatedAt')
    .reverse()
    .filter(item => item.deletedAt === null && item.kind === 'expense' && matches(item.paymentMethodId))
    .first()
  return transaction?.paymentMethodId
    ? active.get(transaction.paymentMethodId)
    : undefined
}

/**
 * What a new expense starts from: the last used, among the methods of `accountId` when an account
 * is chosen, then the last used of all, then the first of the list.
 */
export async function startingPaymentMethod(accountId?: string): Promise<PaymentMethod | undefined> {
  return (accountId
    ? await lastUsedPaymentMethod(accountId)
    : undefined)
  ?? await lastUsedPaymentMethod()
  ?? (await listPaymentMethods())[0]
}
