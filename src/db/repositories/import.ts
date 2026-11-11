import type { Category, ImportColumnMapping, ImportPreset, ImportRule, Transaction } from '../schema'
import type { DuplicateCandidate } from '@/import/duplicates'
import { addDays, isIsoDate } from '@/domain/dates'
import { isValidAmountCents } from '@/domain/money'
import { normalizeText } from '@/domain/search'
import { DUPLICATE_DAYS } from '@/import/duplicates'
import { db } from '../database'
import { newRecord, now } from '../records'
import { DEFAULT_CURRENCY, MAX_RULE_PATTERN } from '../schema'

/**
 * The import from a bank statement in the database (docs/specs/import-da-file.md, "Dati"):
 * category rules, how each bank's file is read, the checks before importing and the import
 * itself, all or nothing, with its undo.
 */

export type RuleKind = ImportRule['kind']

export interface ImportRuleInput {
  pattern: string
  kind: RuleKind
  categoryId: string
}

/** A keyword on one line, single spaces; RangeError when empty or too long. */
export function cleanPattern(pattern: string): string {
  const clean = pattern.replace(/\s+/g, ' ').trim()
  if (!clean || clean.length > MAX_RULE_PATTERN)
    throw new RangeError(`Invalid rule keyword: "${pattern}"`)
  return clean
}

/** Rules not deleted whose category still exists, by keyword. */
export async function listImportRules(): Promise<ImportRule[]> {
  const [rules, categories] = await Promise.all([
    db.importRules.filter(rule => rule.deletedAt === null).toArray(),
    db.categories.filter(category => category.deletedAt === null).primaryKeys(),
  ])
  const alive = new Set(categories)
  return rules
    .filter(rule => alive.has(rule.categoryId))
    .sort((a, b) => normalizeText(a.pattern).localeCompare(normalizeText(b.pattern)) || a.kind.localeCompare(b.kind))
}

async function findSamePattern(pattern: string, kind: RuleKind, except?: string): Promise<ImportRule | undefined> {
  const key = normalizeText(pattern)
  return db.importRules
    .filter(rule => rule.deletedAt === null && rule.kind === kind && rule.id !== except && normalizeText(rule.pattern) === key)
    .first()
}

/**
 * Adds a rule, or changes the one with the same keyword and kind: one keyword leads to one
 * category. Returns the rule saved and whether it is new.
 */
export async function saveImportRule(input: ImportRuleInput & { id?: string }): Promise<{ rule: ImportRule, created: boolean }> {
  const pattern = cleanPattern(input.pattern)
  return db.transaction('rw', db.importRules, async () => {
    const same = await findSamePattern(pattern, input.kind, input.id)
    const existing = input.id
      ? await db.importRules.get(input.id)
      : same
    const timestamp = now()
    if (existing && existing.deletedAt === null) {
      // Changing a rule into the keyword of another one: the other one goes.
      if (same && input.id && same.id !== existing.id)
        await db.importRules.update(same.id, { deletedAt: timestamp, updatedAt: timestamp })
      const rule: ImportRule = {
        ...existing,
        pattern,
        kind: input.kind,
        categoryId: input.categoryId,
        updatedAt: timestamp,
      }
      await db.importRules.put(rule)
      return { rule, created: false }
    }
    const rule: ImportRule = {
      ...newRecord(),
      pattern,
      kind: input.kind,
      categoryId: input.categoryId,
    }
    await db.importRules.add(rule)
    return { rule, created: true }
  })
}

export async function deleteImportRule(id: string): Promise<void> {
  const timestamp = now()
  await db.importRules.update(id, { deletedAt: timestamp, updatedAt: timestamp })
}

/** Undoes deleteImportRule («Annulla» in the notice). */
export async function restoreImportRule(id: string): Promise<void> {
  await db.importRules.update(id, {
    deletedAt: null,
    updatedAt: now(),
  })
}

/** How the file with these column names was read last time. */
export async function findImportPreset(signature: string): Promise<ImportPreset | undefined> {
  const presets = await db.importPresets.where('signature').equals(signature).filter(preset => preset.deletedAt === null).toArray()
  return presets.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
}

export interface ImportPresetInput {
  signature: string
  mapping: ImportColumnMapping
  dateFormat: ImportPreset['dateFormat']
  accountId: string
}

async function saveImportPresetIn(input: ImportPresetInput): Promise<void> {
  const existing = await findImportPreset(input.signature)
  if (existing) {
    await db.importPresets.put({
      ...existing,
      ...input,
      updatedAt: now(),
    })
  }
  else {
    await db.importPresets.add({
      ...newRecord(),
      ...input,
    })
  }
}

/** The ids among these already in Soldo, deleted transactions included: a deletion is kept. */
export async function importedExternalIds(ids: readonly string[]): Promise<Set<string>> {
  if (!ids.length)
    return new Set()
  const found = await db.transactions.where('externalId').anyOf([...ids]).toArray()
  return new Set(found.map(transaction => transaction.externalId!))
}

/**
 * Transactions that a row of the statement may duplicate: typed by hand or added by a series,
 * not imported, from 3 days before the first date to 3 days after the last.
 */
export async function duplicateCandidates(from: string, to: string): Promise<(DuplicateCandidate & { transaction: Transaction })[]> {
  const rows = await db.transactions
    .where('date')
    .between(addDays(from, -DUPLICATE_DAYS), addDays(to, DUPLICATE_DAYS), true, true)
    .filter(transaction => transaction.deletedAt === null
      && transaction.kind !== 'transfer'
      && !transaction.externalId
      && transaction.source !== 'import')
    .toArray()
  return rows.map(transaction => ({
    id: transaction.id,
    kind: transaction.kind,
    date: transaction.date,
    amountCents: transaction.amountCents,
    transaction,
  }))
}

/**
 * The category of a row with no rule: «Altro» for expenses and «Altre entrate» for income,
 * or the first one of that kind still in use.
 */
export async function fallbackCategories(): Promise<Record<RuleKind, string | undefined>> {
  const categories = await db.categories.filter(category => category.deletedAt === null && !category.archived).toArray()
  const pick = (kind: Category['kind'], preset: Category['preset']) =>
    categories.find(category => category.kind === kind && category.preset === preset)?.id
    ?? categories.filter(category => category.kind === kind).sort((a, b) => a.order - b.order)[0]?.id
  return {
    expense: pick('expense', 'other'),
    income: pick('income', 'otherIncome'),
  }
}

export interface ImportPlan {
  accountId: string
  /** Rows to add, the amount with its sign as read. */
  add: { externalId: string, date: string, amountCents: number, note: string, categoryId: string }[]
  /** Transactions typed by hand that the statement confirms: they get the id of the row. */
  merge: { transactionId: string, externalId: string }[]
  /** Rules chosen in the preview. */
  rules: ImportRuleInput[]
  /** How this file was read, for the next one of the same bank. */
  preset?: Omit<ImportPresetInput, 'accountId'>
}

/** What undoImport needs. */
export interface ImportResult {
  added: string[]
  merged: string[]
  rulesCreated: string[]
}

/**
 * Adds the movements, merges the duplicates, keeps rules and preset, in one transaction:
 * all of it or nothing. Expenses get the first payment method of the account, if it has one.
 */
export async function commitImport(plan: ImportPlan): Promise<ImportResult> {
  for (const row of plan.add) {
    if (!isIsoDate(row.date) || !isValidAmountCents(Math.abs(row.amountCents)))
      throw new RangeError(`Invalid row: ${row.date} ${row.amountCents}`)
  }
  return db.transaction('rw', [
    db.transactions,
    db.importRules,
    db.importPresets,
    db.paymentMethods,
    db.accounts,
  ], async () => {
    const account = await db.accounts.get(plan.accountId)
    if (!account || account.deletedAt !== null)
      throw new RangeError(`No account ${plan.accountId}`)
    const method = (await db.paymentMethods
      .filter(item => item.deletedAt === null && !item.archived && item.accountId === plan.accountId)
      .toArray())
      .sort((a, b) => a.order - b.order)[0]

    const transactions: Transaction[] = plan.add.map(row => ({
      ...newRecord(),
      kind: row.amountCents < 0
        ? 'expense'
        : 'income',
      amountCents: Math.abs(row.amountCents),
      currency: account.currency || DEFAULT_CURRENCY,
      date: row.date,
      accountId: plan.accountId,
      categoryId: row.categoryId,
      note: row.note,
      source: 'import',
      externalId: row.externalId,
      ...(row.amountCents < 0 && method
        ? { paymentMethodId: method.id }
        : {}),
    }))
    await db.transactions.bulkAdd(transactions)

    const timestamp = now()
    for (const item of plan.merge)
      await db.transactions.update(item.transactionId, { externalId: item.externalId, updatedAt: timestamp })

    const rulesCreated: string[] = []
    for (const input of plan.rules) {
      const { rule, created } = await saveImportRule(input)
      if (created)
        rulesCreated.push(rule.id)
    }
    if (plan.preset)
      await saveImportPresetIn({ ...plan.preset, accountId: plan.accountId })

    return {
      added: transactions.map(transaction => transaction.id),
      merged: plan.merge.map(item => item.transactionId),
      rulesCreated,
    }
  })
}

/**
 * Undoes commitImport («Annulla» in the notice): the added movements go for good, so the same
 * file can be imported again; the merged ones lose the id; the new rules go. The preset stays.
 */
export async function undoImport(result: ImportResult): Promise<void> {
  await db.transaction('rw', db.transactions, db.importRules, async () => {
    await db.transactions.bulkDelete(result.added)
    const timestamp = now()
    for (const id of result.merged) {
      const transaction = await db.transactions.get(id)
      if (transaction) {
        const { externalId: _, ...rest } = transaction
        await db.transactions.put({ ...rest, updatedAt: timestamp })
      }
    }
    await db.importRules.bulkDelete(result.rulesCreated)
  })
}
