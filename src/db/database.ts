import type { EntityTable } from 'dexie'
import type { Account, Budget, Category, KeyValue, Recurrence, Transaction } from './schema'
import Dexie from 'dexie'

/**
 * The IndexedDB database (docs/specs/dati-locali.md, "Schema"). IndexedDB cannot index
 * booleans or null, so archived and deleted rows are filtered in memory.
 */
export class SoldoDatabase extends Dexie {
  // `declare`: with useDefineForClassFields, a plain field would shadow the table Dexie sets up.
  declare accounts: EntityTable<Account, 'id'>
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
  }
}

export const db = new SoldoDatabase()
