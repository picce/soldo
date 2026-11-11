import type { Cell, ColumnMapping, DateFormat, ImportedRow } from './types'
import { normalizeText } from '@/domain/search'
import { oneLine } from './text'
import { detectDateFormat, looksLikeDate, parseDate, parseSignedAmount } from './values'

/**
 * The columns of a CSV or Excel statement (docs/specs/import-da-file.md): where the data
 * starts, what each column holds, and the rows that come out of it.
 */

export interface SheetLayout {
  /** Index of the row with the column names, if the sheet has one. */
  headerRow: number | null
  /** Index of the first row of data. */
  dataStart: number
  /** Number of columns. */
  width: number
  /** Column names as written; null where the sheet has none. */
  names: (string | null)[]
}

/** What Soldo proposes: any field can be missing when nothing fits it. */
export interface GuessedMapping {
  date?: number
  description?: number
  description2?: number
  amount?: ColumnMapping['amount']
}

function asText(cell: Cell | undefined): string {
  return cell === null || cell === undefined
    ? ''
    : String(cell)
}

function filled(row: readonly Cell[]): number {
  return row.filter(cell => asText(cell).trim() !== '').length
}

/** A row of data has a date, a non-zero amount in another cell, and at least three cells. */
function isDataRow(row: readonly Cell[]): boolean {
  if (filled(row) < 3)
    return false
  const dateAt = row.findIndex(looksLikeDate)
  return dateAt >= 0 && row.some((cell, index) => index !== dateAt && !looksLikeDate(cell) && !!parseSignedAmount(cell))
}

/** Where the data starts: the first row of data followed by another one (or the last). */
export function findLayout(table: readonly (readonly Cell[])[]): SheetLayout | null {
  const limit = Math.min(table.length, 80)
  for (let index = 0; index < limit; index++) {
    if (!isDataRow(table[index]!))
      continue
    const next = table[index + 1]
    if (next && !isDataRow(next) && !table.slice(index + 1, index + 4).some(isDataRow))
      continue
    const previous = table[index - 1]
    const headerRow = previous && filled(previous) >= 2 && !previous.some(looksLikeDate)
      ? index - 1
      : null
    const width = Math.max(...table.slice(index).map(row => row.length), headerRow === null
      ? 0
      : table[headerRow]!.length)
    const names = Array.from({ length: width }, (_, column) => {
      const name = headerRow === null
        ? ''
        : asText(table[headerRow]![column]).trim()
      return name || null
    })
    return {
      headerRow,
      dataStart: index,
      width,
      names,
    }
  }
  return null
}

/** The column names, normalized: the same bank gives the same signature at every export. */
export function signatureOf(layout: SheetLayout): string {
  return layout.headerRow === null
    ? `#${layout.width}`
    : layout.names.map(name => normalizeText(name ?? '')).join('|')
}

const DATE_NAMES = [
  { pattern: /^data (contabile|operazione|registrazione|transazione)|booking date|transaction date|posting date|^data$|^date$|^data mov/, score: 3 },
  { pattern: /valuta|value date/, score: 1 },
  { pattern: /data|date/, score: 2 },
]
const SINGLE_NAMES = /importo|amount|ammontare|valore|movimento|^euro?$/
const DEBIT_NAMES = /dare|addebit|uscit|debit|prelev|withdraw|paid out|money out/
const CREDIT_NAMES = /avere|accredit|entrat|credit|versam|deposit|paid in|money in/
const BALANCE_NAMES = /saldo|balance/
const DESCRIPTION_NAMES = [
  { pattern: /descrizione|description|dettagl|details|beneficiario|payee|esercente|merchant|controparte|counterpart/, score: 3 },
  { pattern: /causale|operazione|tipo|memo|riferimento|reference|narrative|motivo|note/, score: 2 },
]

function scoreName(name: string, table: readonly { pattern: RegExp, score: number }[]): number {
  return table.find(entry => entry.pattern.test(name))?.score ?? 0
}

/** Proposes the mapping from the column names first, then from what the columns hold. */
export function guessMapping(table: readonly (readonly Cell[])[], layout: SheetLayout): GuessedMapping {
  const data = table.slice(layout.dataStart)
  const names = layout.names.map(name => normalizeText(name ?? ''))
  const columns = Array.from({ length: layout.width }, (_, column) => column)
  const values = (column: number) => data.map(row => row[column] ?? null)
  const nonEmpty = (column: number) => values(column).filter(cell => asText(cell).trim() !== '')
  const share = (column: number, test: (cell: Cell) => boolean) => {
    const cells = nonEmpty(column)
    return cells.length
      ? cells.filter(test).length / cells.length
      : 0
  }

  const dateColumns = columns.filter(column => share(column, looksLikeDate) >= 0.6 && nonEmpty(column).length >= data.length * 0.6)
  const date = dateColumns
    .map(column => ({
      column,
      score: scoreName(names[column]!, DATE_NAMES),
    }))
    .sort((a, b) => b.score - a.score || a.column - b.column)[0]
    ?.column

  const amountColumns = columns.filter(column => column !== date
    && !BALANCE_NAMES.test(names[column]!)
    && !dateColumns.includes(column)
    && share(column, cell => parseSignedAmount(cell) !== null) >= 0.8)
  let amount: ColumnMapping['amount'] | undefined
  const debit = amountColumns.find(column => DEBIT_NAMES.test(names[column]!))
  const credit = amountColumns.find(column => CREDIT_NAMES.test(names[column]!))
  const single = amountColumns.find(column => SINGLE_NAMES.test(names[column]!) && !DEBIT_NAMES.test(names[column]!) && !CREDIT_NAMES.test(names[column]!))
  if (debit !== undefined && credit !== undefined && debit !== credit) {
    amount = { kind: 'split', debit, credit }
  }
  else if (single !== undefined) {
    amount = { kind: 'single', column: single }
  }
  else {
    // From the content: one column filled in almost every row, or two that share the rows.
    const full = amountColumns.find(column => nonEmpty(column).length >= data.length * 0.9)
    if (full !== undefined) {
      amount = { kind: 'single', column: full }
    }
    else if (amountColumns.length >= 2) {
      const [first, second] = amountColumns as [number, number]
      const negative = (column: number) => values(column).some(cell => (parseSignedAmount(cell) ?? 0) < 0)
      amount = negative(second) && !negative(first)
        ? { kind: 'split', debit: second, credit: first }
        : { kind: 'split', debit: first, credit: second }
    }
  }

  const used = new Set<number>([
    date,
    ...(amount?.kind === 'single'
      ? [amount.column]
      : []),
    ...(amount?.kind === 'split'
      ? [amount.debit, amount.credit]
      : []),
  ].filter((column): column is number => column !== undefined))
  const average = (column: number) => {
    const cells = nonEmpty(column)
    return cells.length
      ? cells.reduce<number>((sum, cell) => sum + asText(cell).length, 0) / cells.length
      : 0
  }
  const textColumns = columns
    .filter(column => !used.has(column) && !dateColumns.includes(column) && nonEmpty(column).length > 0)
    .filter(column => share(column, cell => typeof cell === 'string' && parseSignedAmount(cell) === null) >= 0.6)
    .map(column => ({
      column,
      score: scoreName(names[column]!, DESCRIPTION_NAMES),
      length: average(column),
    }))
    .sort((a, b) => b.score - a.score || b.length - a.length)
  const description = textColumns[0]?.column
  const second = textColumns[1]
  const description2 = second && second.score >= 2 && textColumns[0]!.score >= 2
    ? second.column
    : undefined

  return {
    ...(date !== undefined
      ? { date }
      : {}),
    ...(description !== undefined
      ? { description }
      : {}),
    ...(description2 !== undefined
      ? { description2 }
      : {}),
    ...(amount
      ? { amount }
      : {}),
  }
}

/** True when every field needed to read the rows is chosen. */
export function isComplete(mapping: GuessedMapping): mapping is ColumnMapping {
  return mapping.date !== undefined && mapping.description !== undefined && mapping.amount !== undefined
}

/** How the dates of the chosen column are written. */
export function dateFormatOf(table: readonly (readonly Cell[])[], layout: SheetLayout, column: number): DateFormat | null {
  return detectDateFormat(table.slice(layout.dataStart).map(row => row[column] ?? null))
}

/** The movements of the sheet; rows without a date or an amount (totals, balances) are left out. */
export function rowsOf(table: readonly (readonly Cell[])[], layout: SheetLayout, mapping: ColumnMapping, format: DateFormat): ImportedRow[] {
  const rows: ImportedRow[] = []
  for (let index = layout.dataStart; index < table.length; index++) {
    const row = table[index]!
    const date = parseDate(row[mapping.date] ?? null, format)
    let amountCents: number | null
    if (mapping.amount.kind === 'single') {
      amountCents = parseSignedAmount(row[mapping.amount.column] ?? null)
    }
    else {
      const out = parseSignedAmount(row[mapping.amount.debit] ?? null)
      const income = parseSignedAmount(row[mapping.amount.credit] ?? null)
      amountCents = out === null && income === null
        ? null
        : Math.abs(income ?? 0) - Math.abs(out ?? 0)
    }
    if (!date || !amountCents)
      continue
    const parts = [mapping.description, mapping.description2]
      .filter((column): column is number => column !== undefined)
      .map(column => asText(row[column]).trim())
      .filter(Boolean)
    rows.push({
      line: index + 1,
      date,
      amountCents,
      description: oneLine(parts.join(' ')),
    })
  }
  return rows
}

/** The first value of a column in the data, for the example next to its name. */
export function sampleOf(table: readonly (readonly Cell[])[], layout: SheetLayout, column: number): string {
  for (let index = layout.dataStart; index < table.length; index++) {
    const value = asText(table[index]![column]).trim()
    if (value)
      return value
  }
  return ''
}
