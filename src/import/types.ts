import type { IsoDate } from '@/domain/dates'

/**
 * Shared shapes of the import from a bank statement (docs/specs/import-da-file.md).
 */

/** A cell of a CSV or Excel sheet: text, a number (Excel), or nothing. */
export type Cell = string | number | null

/** How the dates of a column are written. */
export type DateFormat = 'dmy' | 'mdy' | 'ymd'

/** A movement read from the file, before it becomes a transaction. */
export interface ImportedRow {
  /** Position in the file, from 1: the same row keeps the same number at every reading. */
  line: number
  date: IsoDate
  /** Negative for money out, positive for money in; never zero. */
  amountCents: number
  /** Description of the bank, one line. */
  description: string
}

/** Which columns of a sheet hold what, by index. */
export interface ColumnMapping {
  date: number
  description: number
  /** A second column joined to the description, such as «Causale» next to «Descrizione». */
  description2?: number
  amount:
    | { kind: 'single', column: number }
    | { kind: 'split', debit: number, credit: number }
}
