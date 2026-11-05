import type { Transaction } from '@/db/schema'

/** Column titles and words that change with the language. */
export interface CsvLabels {
  headers: [date: string, kind: string, amount: string, category: string, account: string, note: string]
  kinds: Record<Transaction['kind'], string>
}

export interface CsvOptions {
  /** `it` writes `;` and `1234,56` (what Excel expects in Italy), `en` writes `,` and `1234.56`. */
  locale: 'it' | 'en'
  labels: CsvLabels
  categoryName: (transaction: Transaction) => string
  accountName: (transaction: Transaction) => string
}

/** Byte order mark: tells Excel that the file is UTF-8, so accented letters survive. */
export const BOM = String.fromCharCode(0xFEFF)

const FORMULA_START = /^[=+\-@\t\r]/

/**
 * One field, quoted as RFC 4180 asks when it holds the separator, quotes or line breaks.
 * Text that a spreadsheet would run as a formula (`=…`, `+…`, `-…`, `@…`) gets a leading
 * apostrophe, so a note cannot turn into one.
 */
function field(value: string, separator: string, text = true): string {
  const safe = text && FORMULA_START.test(value)
    ? `'${value}`
    : value
  return safe.includes(separator) || /["\r\n]/.test(safe)
    ? `"${safe.replaceAll('"', '""')}"`
    : safe
}

/** Signed amount without thousands separators: `-12,40` or `-12.40`; transfers have no sign. */
function amount(transaction: Transaction, decimal: string): string {
  const sign = transaction.kind === 'expense'
    ? '-'
    : ''
  const units = Math.floor(transaction.amountCents / 100)
  const cents = String(transaction.amountCents % 100).padStart(2, '0')
  return `${sign}${units}${decimal}${cents}`
}

/**
 * Transactions as CSV for a spreadsheet (docs/specs/backup-manuale.md): oldest first,
 * deleted ones left out, UTF-8 with a BOM so that Excel reads accented letters.
 */
export function transactionsToCsv(transactions: Transaction[], options: CsvOptions): string {
  const separator = options.locale === 'it'
    ? ';'
    : ','
  const decimal = options.locale === 'it'
    ? ','
    : '.'
  const rows = transactions
    .filter(transaction => transaction.deletedAt === null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map(transaction => [
      field(transaction.date, separator, false),
      field(options.labels.kinds[transaction.kind], separator),
      field(amount(transaction, decimal), separator, false),
      field(options.categoryName(transaction), separator),
      field(options.accountName(transaction), separator),
      field(transaction.note, separator),
    ].join(separator))
  const header = options.labels.headers.map(title => field(title, separator)).join(separator)
  return `${BOM}${[header, ...rows].join('\r\n')}\r\n`
}
