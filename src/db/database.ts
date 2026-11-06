import type { EntityTable } from 'dexie'
import type { Account, Budget, Category, KeyValue, PaymentMethod, Recurrence, Transaction } from './schema'
import Dexie from 'dexie'
import { defaultPaymentMethods, firstActiveAccount } from './payment-defaults'
import { SCHEMA_VERSION } from './schema'

/**
 * The IndexedDB database (docs/specs/released/dati-locali.md, "Schema"). IndexedDB cannot index
 * booleans or null, so archived and deleted rows are filtered in memory.
 */
export class SoldoDatabase extends Dexie {
  // `declare`: with useDefineForClassFields, a plain field would shadow the table Dexie sets up.
  declare accounts: EntityTable<Account, 'id'>
  declare paymentMethods: EntityTable<PaymentMethod, 'id'>
  declare categories: EntityTable<Category, 'id'>
  declare transactions: EntityTable<Transaction, 'id'>
  declare budgets: EntityTable<Budget, 'id'>
  declare recurrences: EntityTable<Recurrence, 'id'>
  declare settings: EntityTable<KeyValue, 'key'>
  declare meta: EntityTable<KeyValue, 'key'>

  constructor(name = 'soldo') {
    super(name)
    this.version(1).stores({
      accounts: 'id, order',
      categories: 'id, kind, order',
      transactions: 'id, date, [kind+date], categoryId, accountId, updatedAt, externalId',
      budgets: 'id, month, categoryId',
      recurrences: 'id',
      settings: 'key',
      meta: 'key',
    })
    // Whoever already has data gets the default payment methods on their first account; a new
    // database skips upgrades, and seedDefaults creates them. Transactions stay as they are.
    this.version(2).stores({
      paymentMethods: 'id, order',
    }).upgrade(async (tx) => {
      const account = firstActiveAccount(await tx.table<Account>('accounts').toArray())
      if (!account)
        return
      await tx.table<PaymentMethod>('paymentMethods').bulkAdd(defaultPaymentMethods(account.id))
      await tx.table<KeyValue>('meta').put({ key: 'schemaVersion', value: SCHEMA_VERSION })
    })
  }
}

export const db = new SoldoDatabase()
