/**
 * Records stored in IndexedDB (docs/specs/dati-locali.md). Schema v1 already holds every
 * table of the roadmap, so later phases add behaviour without destructive migrations.
 */

export const SCHEMA_VERSION = 1

export const DEFAULT_CURRENCY = 'EUR'

/** Fields shared by every record. */
export interface BaseRecord {
  /** UUID generated on the device. */
  id: string
  /** ISO 8601 timestamps. */
  createdAt: string
  updatedAt: string
  /** Soft delete: the row stays, so a future sync between devices can merge deletions. */
  deletedAt: string | null
}

/** One of the eight category colors, in the fixed order of the palette (docs/design). */
export type PaletteColor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export type AccountType = 'cash' | 'card' | 'bank' | 'other'

export type AccountPreset = 'cash'

export interface Account extends BaseRecord {
  /** Name chosen by the user. Without it, the name is the translation of `preset`. */
  name?: string
  preset?: AccountPreset
  type: AccountType
  icon: string
  color: PaletteColor
  initialBalanceCents: number
  currency: string
  archived: boolean
  order: number
}

export type CategoryKind = 'expense' | 'income'

export type ExpensePreset
  = | 'groceries'
    | 'home'
    | 'restaurants'
    | 'transport'
    | 'leisure'
    | 'bills'
    | 'health'
    | 'clothes'
    | 'gifts'
    | 'travel'
    | 'pets'
    | 'other'

export type IncomePreset = 'salary' | 'refunds' | 'giftsReceived' | 'otherIncome'

export type CategoryPreset = ExpensePreset | IncomePreset

export interface Category extends BaseRecord {
  kind: CategoryKind
  /** Name chosen by the user. Without it, the name is the translation of `preset`. */
  name?: string
  preset?: CategoryPreset
  /** Phosphor icon name (scripts/build-icons.js). */
  icon: string
  color: PaletteColor
  order: number
  archived: boolean
}

export type TransactionKind = 'expense' | 'income' | 'transfer'

export type TransactionSource = 'manual' | 'recurring' | 'import' | 'bank'

export interface Transaction extends BaseRecord {
  kind: TransactionKind
  /** Always a positive integer: the sign comes from `kind`. */
  amountCents: number
  currency: string
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string
  accountId: string
  /** Destination account, transfers only (Phase 4). */
  toAccountId?: string
  /** Null for transfers. */
  categoryId: string | null
  note: string
  recurrenceId?: string
  occurrenceDate?: string
  source: TransactionSource
  /** Stable id of an imported row, to skip duplicates (Phase 6). */
  externalId?: string
}

/** Monthly budget, total (`categoryId` null) or per category. Used from Phase 4. */
export interface Budget extends BaseRecord {
  /** `YYYY-MM`. */
  month: string
  categoryId: string | null
  amountCents: number
  repeat: boolean
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

/** Rule that generates transactions. Used from Phase 4. */
export interface Recurrence extends BaseRecord {
  template: Pick<Transaction, 'kind' | 'amountCents' | 'currency' | 'accountId' | 'toAccountId' | 'categoryId' | 'note'>
  freq: RecurrenceFrequency
  interval: number
  startDate: string
  endDate?: string
  lastGeneratedDate?: string
}

/** Rows of the `settings` and `meta` tables. */
export interface KeyValue<T = unknown> {
  key: string
  value: T
}

/** Keys of the `meta` table. */
export type MetaKey = 'schemaVersion' | 'onboardedAt' | 'lastExportAt'
