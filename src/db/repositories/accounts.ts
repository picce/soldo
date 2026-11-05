import type { Account } from '../schema'
import { db } from '../database'

/** Accounts not deleted nor archived, in the user's order. */
export async function listAccounts(): Promise<Account[]> {
  const rows = await db.accounts.filter(account => account.deletedAt === null && !account.archived).toArray()
  return rows.sort((a, b) => a.order - b.order)
}

/** Account used when the user does not pick one: the first in order ("Contanti" after the seed). */
export async function getDefaultAccount(): Promise<Account | undefined> {
  return (await listAccounts())[0]
}
