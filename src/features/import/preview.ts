import type { ImportPlan, ImportRuleInput, RuleKind } from '@/db/repositories/import'
import type { Transaction } from '@/db/schema'
import type { ImportedRow } from '@/import/types'
import { normalizeText } from '@/domain/search'
import { matchRule } from '@/import/rules'

/**
 * The preview of the import (docs/specs/import-da-file.md, "Interfaccia"): each row of the
 * file with its category, whether it goes in, and the transaction it may merge with.
 */

export interface PreviewRow {
  /** The externalId of the row. */
  key: string
  row: ImportedRow
  kind: RuleKind
  categoryId: string | undefined
  /** Category chosen by hand in the preview: a new rule does not change it. */
  manual: boolean
  include: boolean
  /** A transaction typed by hand that this row may be. */
  duplicateOf?: Transaction
  /** With `duplicateOf`: merge with it (the default) instead of adding the row. */
  merge: boolean
}

export type Fallbacks = Record<RuleKind, string | undefined>

/** The category of a row from the rules, or the fallback of its kind. */
export function categoryFor(description: string, kind: RuleKind, rules: readonly ImportRuleInput[], fallbacks: Fallbacks): string | undefined {
  return matchRule(description, kind, rules)?.categoryId ?? fallbacks[kind]
}

export interface PreviewInput {
  rows: readonly ImportedRow[]
  ids: readonly string[]
  imported: ReadonlySet<string>
  duplicates: ReadonlyMap<string, Transaction>
  rules: readonly ImportRuleInput[]
  fallbacks: Fallbacks
}

/** The rows not imported yet, newest first, and how many were already in. */
export function buildPreview(input: PreviewInput): { rows: PreviewRow[], importedCount: number } {
  const rows: PreviewRow[] = []
  let importedCount = 0
  input.rows.forEach((row, index) => {
    const key = input.ids[index]!
    if (input.imported.has(key)) {
      importedCount++
      return
    }
    const kind: RuleKind = row.amountCents < 0
      ? 'expense'
      : 'income'
    const duplicateOf = input.duplicates.get(key)
    rows.push({
      key,
      row,
      kind,
      categoryId: categoryFor(row.description, kind, input.rules, input.fallbacks),
      manual: false,
      include: true,
      ...(duplicateOf
        ? { duplicateOf }
        : {}),
      merge: !!duplicateOf,
    })
  })
  rows.sort((a, b) => b.row.date.localeCompare(a.row.date) || a.row.line - b.row.line)
  return { rows, importedCount }
}

/** Adds a rule to the list, replacing the one with the same keyword and kind. */
export function withRule(rules: readonly ImportRuleInput[], rule: ImportRuleInput): ImportRuleInput[] {
  const key = normalizeText(rule.pattern)
  return [
    ...rules.filter(item => item.kind !== rule.kind || normalizeText(item.pattern) !== key),
    rule,
  ]
}

/** Categories again from the rules, for the rows not chosen by hand. */
export function recategorize(rows: readonly PreviewRow[], rules: readonly ImportRuleInput[], fallbacks: Fallbacks): PreviewRow[] {
  return rows.map(row => row.manual
    ? row
    : {
        ...row,
        categoryId: categoryFor(row.row.description, row.kind, rules, fallbacks),
      })
}

export interface PreviewCounts {
  /** Rows that become new transactions. */
  add: number
  /** Rows merged with a transaction typed by hand. */
  merge: number
}

export function countPreview(rows: readonly PreviewRow[]): PreviewCounts {
  let add = 0
  let merge = 0
  for (const row of rows) {
    if (!row.include)
      continue
    if (row.duplicateOf && row.merge)
      merge++
    else
      add++
  }
  return { add, merge }
}

/** What commitImport receives; rows without a category stay out. */
export function toPlan(accountId: string, rows: readonly PreviewRow[], rules: readonly ImportRuleInput[], preset?: ImportPlan['preset']): ImportPlan {
  const plan: ImportPlan = {
    accountId,
    add: [],
    merge: [],
    rules: [...rules],
  }
  if (preset)
    plan.preset = preset
  for (const row of rows) {
    if (!row.include)
      continue
    if (row.duplicateOf && row.merge) {
      plan.merge.push({ transactionId: row.duplicateOf.id, externalId: row.key })
    }
    else if (row.categoryId) {
      plan.add.push({
        externalId: row.key,
        date: row.row.date,
        amountCents: row.row.amountCents,
        note: row.row.description,
        categoryId: row.categoryId,
      })
    }
  }
  return plan
}
