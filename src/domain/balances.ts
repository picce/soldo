import type { Account, Transaction } from '@/db/schema'

type BalanceTransaction = Pick<Transaction, 'kind' | 'amountCents' | 'date' | 'accountId' | 'toAccountId' | 'deletedAt'>

/**
 * Current balance of each account, in cents (docs/specs/released/conti-pagamenti-trasferimenti.md, "Saldo"):
 * the initial balance, plus income, minus expenses, plus or minus transfers. Deleted transactions
 * do not count, nor do those dated after `today`, until their day comes.
 */
export function accountBalances(
  accounts: Pick<Account, 'id' | 'initialBalanceCents'>[],
  transactions: BalanceTransaction[],
  today: string,
): Map<string, number> {
  const balances = new Map(accounts.map(account => [account.id, account.initialBalanceCents]))
  const add = (id: string | undefined, cents: number) => {
    const balance = id === undefined
      ? undefined
      : balances.get(id)
    if (balance !== undefined)
      balances.set(id!, balance + cents)
  }
  for (const { kind, amountCents, date, accountId, toAccountId, deletedAt } of transactions) {
    if (deletedAt !== null || date > today)
      continue
    if (kind === 'income') {
      add(accountId, amountCents)
    }
    else {
      add(accountId, -amountCents)
      if (kind === 'transfer')
        add(toAccountId, amountCents)
    }
  }
  return balances
}
