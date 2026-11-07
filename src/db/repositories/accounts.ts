import type { Account, AccountType, PaletteColor } from '../schema'
import { db } from '../database'
import { accountName } from '../names'
import { firstActiveAccount } from '../payment-defaults'
import { newRecord, now } from '../records'
import { DEFAULT_CURRENCY } from '../schema'
import { countRecurrenceUses } from './recurrences'

export interface AccountQuery {
  /** Archived accounts are hidden unless asked for (they stay in the history). */
  includeArchived?: boolean
}

/** Longest account name, in characters. */
export const MAX_ACCOUNT_NAME = 24

/** What the user chooses for an account: the rest (type, order, archived) is managed here. */
export interface AccountInput {
  name: string
  icon: string
  color: PaletteColor
  initialBalanceCents: number
}

export type AccountChanges = Partial<AccountInput>

/** Refusal to delete an account that some transactions still use: archive it instead. */
export class AccountInUseError extends Error {
  constructor(readonly accountId: string, readonly count: number) {
    super(`Account ${accountId} is used by ${count} transactions`)
    this.name = 'AccountInUseError'
  }
}

/** Refusal to leave no active account: a transaction could not be saved anywhere. */
export class LastAccountError extends Error {
  constructor(readonly accountId: string) {
    super(`Account ${accountId} is the last active one`)
    this.name = 'LastAccountError'
  }
}

function validName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (!trimmed || trimmed.length > MAX_ACCOUNT_NAME)
    throw new RangeError(`Invalid account name: "${name}"`)
  return trimmed
}

function validBalance(cents: number): number {
  if (!Number.isSafeInteger(cents))
    throw new RangeError(`Invalid balance: ${cents}`)
  return cents
}

/** The type changes nothing in the app, so it is not asked: the icon says it. */
function typeOfIcon(icon: string): AccountType {
  if (icon === 'wallet')
    return 'cash'
  if (icon === 'credit-card')
    return 'card'
  return icon === 'bank'
    ? 'bank'
    : 'other'
}

/** Accounts not deleted, in the user's order; archived ones only if asked for. */
export async function listAccounts(query: AccountQuery = {}): Promise<Account[]> {
  const { includeArchived = false } = query
  const rows = await db.accounts
    .filter(account => account.deletedAt === null && (includeArchived || !account.archived))
    .toArray()
  return rows.sort((a, b) => a.order - b.order)
}

/** Account used when the user does not pick one: the first in order ("Contanti" after the seed). */
export async function getDefaultAccount(): Promise<Account | undefined> {
  return (await listAccounts())[0]
}

export async function getAccount(id: string): Promise<Account | undefined> {
  const account = await db.accounts.get(id)
  return account?.deletedAt === null
    ? account
    : undefined
}

/** Order after every account, archived ones included. */
async function nextOrder(): Promise<number> {
  const rows = await listAccounts({ includeArchived: true })
  return rows.reduce((next, account) => Math.max(next, account.order + 1), 0)
}

/** An account chosen by the user, at the end of the list. */
export async function createAccount(input: AccountInput): Promise<Account> {
  const name = validName(input.name)
  validBalance(input.initialBalanceCents)
  return db.transaction('rw', db.accounts, async () => {
    const account: Account = {
      ...newRecord(),
      name,
      type: typeOfIcon(input.icon),
      icon: input.icon,
      color: input.color,
      initialBalanceCents: input.initialBalanceCents,
      currency: DEFAULT_CURRENCY,
      archived: false,
      order: await nextOrder(),
    }
    await db.accounts.add(account)
    return account
  })
}

/**
 * Changes an account. A default account keeps following the app language while its name is the
 * translation of its preset; any other name detaches it for good.
 */
export async function updateAccount(id: string, changes: AccountChanges): Promise<void> {
  const account = await getAccount(id)
  if (!account)
    throw new Error(`Account not found: ${id}`)
  const { name, icon, initialBalanceCents, color } = changes
  const update: Partial<Account> = {
    updatedAt: now(),
  }
  if (color !== undefined)
    update.color = color
  if (icon !== undefined) {
    update.icon = icon
    update.type = typeOfIcon(icon)
  }
  if (initialBalanceCents !== undefined)
    update.initialBalanceCents = validBalance(initialBalanceCents)
  if (name !== undefined) {
    const trimmed = validName(name)
    update.name = account.preset && trimmed === accountName({ preset: account.preset })
      ? undefined
      : trimmed
  }
  await db.accounts.update(id, update)
}

/** Saves the order of the list: `ids` from first to last. Only moved rows change. */
export async function reorderAccounts(ids: string[]): Promise<void> {
  const timestamp = now()
  await db.transaction('rw', db.accounts, async () => {
    const rows = await db.accounts.bulkGet(ids)
    await Promise.all(rows.map((account, order) => account && account.order !== order
      ? db.accounts.update(account.id, { order, updatedAt: timestamp })
      : undefined))
  })
}

/** Transactions (not deleted) on the account, transfers to it included. */
export async function countAccountTransactions(id: string): Promise<number> {
  return db.transactions
    .filter(transaction => transaction.deletedAt === null && (transaction.accountId === id || transaction.toAccountId === id))
    .count()
}

/**
 * The account another one's payment methods move to when it goes away: the default account
 * without it. Throws when there is none, because it was the last active account.
 */
async function successorOf(id: string): Promise<Account> {
  const successor = firstActiveAccount((await db.accounts.toArray()).filter(account => account.id !== id))
  if (!successor)
    throw new LastAccountError(id)
  return successor
}

/** Moves the account's payment methods to another one; returns those moved, for «Annulla». */
async function movePaymentMethods(from: string, to: string): Promise<string[]> {
  const methods = await db.paymentMethods.filter(method => method.accountId === from && method.deletedAt === null).toArray()
  const timestamp = now()
  await Promise.all(methods.map(method => db.paymentMethods.update(method.id, { accountId: to, updatedAt: timestamp })))
  return methods.map(method => method.id)
}

async function bringPaymentMethodsBack(id: string, methodIds: string[]) {
  const timestamp = now()
  await Promise.all(methodIds.map(methodId => db.paymentMethods.update(methodId, { accountId: id, updatedAt: timestamp })))
}

/**
 * Hides the account from the choices; its transactions keep it. Its payment methods move to the
 * default account: the returned ids are what `unarchiveAccount` needs to bring them back.
 */
export async function archiveAccount(id: string): Promise<string[]> {
  return db.transaction('rw', db.accounts, db.paymentMethods, async () => {
    const successor = await successorOf(id)
    await db.accounts.update(id, {
      archived: true,
      updatedAt: now(),
    })
    return movePaymentMethods(id, successor.id)
  })
}

/** Brings an archived account back: at `order` with its payment methods (undo), or at the end. */
export async function unarchiveAccount(id: string, undo?: { order: number, methodIds: string[] }): Promise<void> {
  await db.transaction('rw', db.accounts, db.paymentMethods, async () => {
    if (!(await getAccount(id)))
      return
    await db.accounts.update(id, {
      archived: false,
      order: undo?.order ?? await nextOrder(),
      updatedAt: now(),
    })
    await bringPaymentMethodsBack(id, undo?.methodIds ?? [])
  })
}

/**
 * Soft delete, only for an account no transaction or series uses: otherwise AccountInUseError. Its
 * payment methods move as when archiving, and the returned ids are for `restoreAccount`.
 */
export async function deleteAccount(id: string): Promise<string[]> {
  return db.transaction('rw', [
    db.accounts,
    db.paymentMethods,
    db.transactions,
    db.recurrences,
  ], async () => {
    const count = await countAccountTransactions(id) + await countRecurrenceUses({ accountId: id })
    if (count > 0)
      throw new AccountInUseError(id, count)
    const successor = await successorOf(id)
    const timestamp = now()
    await db.accounts.update(id, { deletedAt: timestamp, updatedAt: timestamp })
    return movePaymentMethods(id, successor.id)
  })
}

/** Undoes deleteAccount ("Annulla" in the notice). */
export async function restoreAccount(id: string, methodIds: string[] = []): Promise<void> {
  await db.transaction('rw', db.accounts, db.paymentMethods, async () => {
    await db.accounts.update(id, {
      deletedAt: null,
      updatedAt: now(),
    })
    await bringPaymentMethodsBack(id, methodIds)
  })
}
