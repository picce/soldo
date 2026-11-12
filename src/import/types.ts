import type { DATE_FORMATS, ImportColumnMapping } from '@/db/schema'
import type { IsoDate } from '@/domain/dates'

/**
 * Shared shapes of the import from a bank statement (docs/specs/released/import-da-file.md).
 */

/** A cell of a CSV or Excel sheet: text, a number (Excel), or nothing. */
export type Cell = string | number | null

/** How the dates of a column are written. */
export type DateFormat = typeof DATE_FORMATS[number]

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

/** Which columns of a sheet hold what, by index; kept in the presets of the database. */
export type ColumnMapping = ImportColumnMapping
