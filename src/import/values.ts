import type { Cell, DateFormat } from './types'
import type { IsoDate } from '@/domain/dates'
import { isIsoDate, toIsoDate } from '@/domain/dates'
import { parseAmount } from '@/domain/money'

/**
 * Amounts and dates as the banks write them (docs/specs/import-da-file.md).
 */

/**
 * An amount with its sign, in cents: `-1.234,56`, `1,234.56`, `12,50-`, `(12,50)`, `€ 12,50`,
 * `-12.50 EUR`, or a number from Excel. Null when the cell is not an amount (an empty cell, a
 * date, a text).
 */
export function parseSignedAmount(cell: Cell): number | null {
  if (cell === null)
    return null
  if (typeof cell === 'number') {
    const cents = Math.round(cell * 100)
    return Number.isSafeInteger(cents)
      ? cents
      : null
  }
  let text = cell.trim().replace(/[\s']/g, '')
  if (!text)
    return null
  let negative = false
  if (/^\(.*\)$/.test(text)) {
    negative = true
    text = text.slice(1, -1)
  }
  text = text.replace(/^(?:€|EUR)|(?:€|EUR)$/gi, '')
  if (/^[-−]/.test(text)) {
    negative = true
    text = text.slice(1)
  }
  else if (/^\+/.test(text)) {
    text = text.slice(1)
  }
  else if (/[-−]$/.test(text)) {
    negative = true
    text = text.slice(0, -1)
  }
  text = text.replace(/^(?:€|EUR)|(?:€|EUR)$/gi, '')
  // A date is not an amount, even if `12.03` would read as one.
  if (!/^\d/.test(text) || /^\d{1,4}[./-]\d{1,2}[./-]\d{2,4}$/.test(text))
    return null
  const cents = parseAmount(text)
  if (cents === null)
    return null
  return negative
    ? -cents
    : cents
}

/** Days from 1899-12-30 (the Excel epoch, with its 1900 leap year) between 1954 and 2119. */
const EXCEL_DAYS = { min: 20000, max: 80000 }

function excelDate(serial: number): IsoDate | null {
  if (serial < EXCEL_DAYS.min || serial > EXCEL_DAYS.max)
    return null
  const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000)
  return toIsoDate(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function isoOf(year: number, month: number, day: number): IsoDate | null {
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return isIsoDate(iso)
    ? iso
    : null
}

/**
 * A date written as `format` says: `12/03/2026`, `12-03-26`, `12.03.2026`, `2026-03-12`,
 * `20260312` (OFX), with or without a time after it; or a date of Excel. Years of two digits
 * are of the 2000s.
 */
export function parseDate(cell: Cell, format: DateFormat): IsoDate | null {
  if (cell === null)
    return null
  if (typeof cell === 'number')
    return excelDate(cell)
  const text = cell.trim()
  const compact = /^(\d{4})(\d{2})(\d{2})(?:\D|\d{2}|$)/.exec(text)
  if (compact && format === 'ymd')
    return isoOf(Number(compact[1]), Number(compact[2]), Number(compact[3]))
  const match = /^(\d{1,4})[/.\-'](\d{1,2})[/.\-'](\d{2,4})(?:$|[\sT])/.exec(text)
  if (!match)
    return null
  const [first, second, third] = [match[1]!, match[2]!, match[3]!]
  const year = (value: string) => value.length === 2
    ? 2000 + Number(value)
    : value.length === 4
      ? Number(value)
      : Number.NaN
  if (format === 'ymd') {
    return first.length === 4
      ? isoOf(Number(first), Number(second), Number(third))
      : null
  }
  if (first.length > 2)
    return null
  return format === 'dmy'
    ? isoOf(year(third), Number(second), Number(first))
    : isoOf(year(third), Number(first), Number(second))
}

const FORMATS: readonly DateFormat[] = ['ymd', 'dmy', 'mdy']

/**
 * The format that reads every date of a column (or the most of them): day before month,
 * as in Italy, when both read them all. Null when no format reads any.
 */
export function detectDateFormat(cells: readonly Cell[]): DateFormat | null {
  const values = cells.filter(cell => cell !== null && cell !== '')
  let best: { format: DateFormat, read: number } | null = null
  for (const format of FORMATS) {
    const read = values.filter(cell => parseDate(cell, format) !== null).length
    if (read > 0 && (!best || read > best.read))
      best = { format, read }
  }
  return best?.format ?? null
}

/** True when the cell reads as a date in some format: to find the first row of data. */
export function looksLikeDate(cell: Cell): boolean {
  return FORMATS.some(format => parseDate(cell, format) !== null)
}
