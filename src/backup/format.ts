import type { Account, Budget, Category, KeyValue, Recurrence, Transaction } from '@/db/schema'
import { z } from 'zod'
import {
  ACCOUNT_PRESETS,
  ACCOUNT_TYPES,
  CATEGORY_KINDS,
  EXPENSE_PRESETS,
  INCOME_PRESETS,
  RECURRENCE_FREQUENCIES,
  TRANSACTION_KINDS,
  TRANSACTION_SOURCES,
} from '@/db/schema'
import { isIsoDate } from '@/domain/dates'
import { isValidAmountCents } from '@/domain/money'
import { BACKUP_FORMAT } from './version'

/**
 * The backup file (docs/specs/released/backup-manuale.md): every table, deleted rows included, in a
 * versioned JSON (BACKUP_FORMAT in version.ts). The same format will travel to Google
 * Drive in Phase 3.
 */

const timestamp = z.iso.datetime()
const calendarDate = z.string().refine(isIsoDate, 'Not a calendar date')
const cents = z.number().refine(isValidAmountCents, 'Not a valid amount in cents')
const paletteColor = z.literal([1, 2, 3, 4, 5, 6, 7, 8])

const baseRecord = {
  id: z.string().min(1),
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp.nullable(),
}

const accountSchema: z.ZodType<Account> = z.object({
  ...baseRecord,
  name: z.string().optional(),
  preset: z.enum(ACCOUNT_PRESETS).optional(),
  type: z.enum(ACCOUNT_TYPES),
  icon: z.string(),
  color: paletteColor,
  initialBalanceCents: z.number().int(),
  currency: z.string(),
  archived: z.boolean(),
  order: z.number(),
})

const categorySchema: z.ZodType<Category> = z.object({
  ...baseRecord,
  kind: z.enum(CATEGORY_KINDS),
  name: z.string().optional(),
  preset: z.enum([
    ...EXPENSE_PRESETS,
    ...INCOME_PRESETS,
  ]).optional(),
  icon: z.string(),
  color: paletteColor,
  order: z.number(),
  archived: z.boolean(),
})

const transactionSchema: z.ZodType<Transaction> = z.object({
  ...baseRecord,
  kind: z.enum(TRANSACTION_KINDS),
  amountCents: cents,
  currency: z.string(),
  date: calendarDate,
  accountId: z.string(),
  toAccountId: z.string().optional(),
  categoryId: z.string().nullable(),
  note: z.string(),
  recurrenceId: z.string().optional(),
  occurrenceDate: calendarDate.optional(),
  source: z.enum(TRANSACTION_SOURCES),
  externalId: z.string().optional(),
})

const budgetSchema: z.ZodType<Budget> = z.object({
  ...baseRecord,
  month: z.string().regex(/^\d{4}-\d{2}$/),
  categoryId: z.string().nullable(),
  amountCents: cents,
  repeat: z.boolean(),
})

const recurrenceSchema: z.ZodType<Recurrence> = z.object({
  ...baseRecord,
  template: z.object({
    kind: z.enum(TRANSACTION_KINDS),
    amountCents: cents,
    currency: z.string(),
    accountId: z.string(),
    toAccountId: z.string().optional(),
    categoryId: z.string().nullable(),
    note: z.string(),
  }),
  freq: z.enum(RECURRENCE_FREQUENCIES),
  interval: z.number().int().positive(),
  startDate: calendarDate,
  endDate: calendarDate.optional(),
  lastGeneratedDate: calendarDate.optional(),
})

const keyValueSchema: z.ZodType<KeyValue> = z.object({
  key: z.string(),
  value: z.unknown(),
}) as z.ZodType<KeyValue>

export const backupDataSchema = z.object({
  accounts: z.array(accountSchema),
  categories: z.array(categorySchema),
  transactions: z.array(transactionSchema),
  budgets: z.array(budgetSchema),
  recurrences: z.array(recurrenceSchema),
  settings: z.array(keyValueSchema),
  meta: z.array(keyValueSchema),
})

export const backupFileSchema = z.object({
  app: z.literal('soldo'),
  format: z.literal(BACKUP_FORMAT),
  exportedAt: timestamp,
  appVersion: z.string(),
  schemaVersion: z.number().int(),
  data: backupDataSchema,
})

export type BackupData = z.infer<typeof backupDataSchema>
export type BackupFile = z.infer<typeof backupFileSchema>
