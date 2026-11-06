import type { Ref } from 'vue'
import type { Account } from '@/db/schema'
import { computed } from 'vue'
import { listTransactions } from '@/db/repositories/transactions'
import { useLiveQuery } from '@/db/useLiveQuery'
import { accountBalances } from '@/domain/balances'
import { today } from '@/domain/dates'

/**
 * Current balance of each account. It reads every transaction, so it runs only while `enabled`
 * says the balances are on screen.
 */
export function useAccountBalances(accounts: Ref<Account[] | undefined>, enabled?: Ref<boolean>) {
  const { data: transactions } = useLiveQuery(
    async () => !enabled || enabled.value
      ? listTransactions({
          to: today(),
        })
      : undefined,
    enabled
      ? [enabled]
      : [],
  )
  return computed(() => accountBalances(accounts.value ?? [], transactions.value ?? [], today()))
}
