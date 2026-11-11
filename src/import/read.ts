import type { Cell, ImportedRow } from './types'
import { isCamt, readCamt } from './camt'
import { readCsv } from './csv'
import { isOfx, readOfx } from './ofx'
import { isQif, readQif } from './qif'
import { decodeText } from './text'
import { readXlsx } from './xlsx'
import { isZip } from './zip'

/**
 * Opens a bank statement (docs/specs/import-da-file.md) and tells what it is: a sheet whose
 * columns are still to be chosen (CSV, Excel), or movements already read (OFX, QIF, CAMT.053).
 */

export type StatementFormat = 'csv' | 'xlsx' | 'ofx' | 'qif' | 'camt'

export type Statement
  = | { kind: 'sheet', format: 'csv' | 'xlsx', fileName: string, table: Cell[][] }
    | { kind: 'rows', format: 'ofx' | 'qif' | 'camt', fileName: string, rows: ImportedRow[] }

/** `empty`: nothing to import; `unsupported`: old Excel, PDF, any other file; `unreadable`: broken. */
export type StatementError = 'empty' | 'unsupported' | 'unreadable'

export type StatementReading = { ok: true, statement: Statement } | { ok: false, error: StatementError }

/** A statement of a few years is well below this. */
export const MAX_STATEMENT_BYTES = 20 * 1024 * 1024

function isOldExcel(bytes: Uint8Array): boolean {
  return bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0
}

function isPdf(bytes: Uint8Array): boolean {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
}

/** Text that is not a table of data: a binary file read as text has control characters. */
function isBinary(text: string): boolean {
  const sample = text.slice(0, 2000)
  // eslint-disable-next-line no-control-regex
  return (sample.match(/[\u0000-\u0008\u000E-\u001F]/g)?.length ?? 0) > sample.length / 50
}

const fail = (error: StatementError): StatementReading => ({ ok: false, error })

export async function readStatementBytes(bytes: Uint8Array<ArrayBuffer>, fileName: string): Promise<StatementReading> {
  if (!bytes.length)
    return fail('empty')
  if (bytes.length > MAX_STATEMENT_BYTES || isOldExcel(bytes) || isPdf(bytes))
    return fail('unsupported')
  if (isZip(bytes)) {
    let table: Cell[][]
    try {
      table = await readXlsx(bytes)
    }
    catch {
      return fail('unsupported')
    }
    return table.length
      ? {
          ok: true,
          statement: {
            kind: 'sheet',
            format: 'xlsx',
            fileName,
            table,
          },
        }
      : fail('empty')
  }

  const text = decodeText(bytes)
  if (isBinary(text))
    return fail('unsupported')
  if (!text.trim())
    return fail('empty')
  const rows = (format: 'ofx' | 'qif' | 'camt', read: ImportedRow[] | null): StatementReading => {
    if (!read)
      return fail('unreadable')
    return read.length
      ? {
          ok: true,
          statement: {
            kind: 'rows',
            format,
            fileName,
            rows: read,
          },
        }
      : fail('empty')
  }
  if (isOfx(text))
    return rows('ofx', readOfx(text))
  if (isCamt(text))
    return rows('camt', readCamt(text))
  if (isQif(text))
    return rows('qif', readQif(text))
  if (/^\s*</.test(text))
    return fail('unsupported')
  const table = readCsv(text)
  return table.length
    ? {
        ok: true,
        statement: {
          kind: 'sheet',
          format: 'csv',
          fileName,
          table,
        },
      }
    : fail('empty')
}

export async function readStatement(file: File): Promise<StatementReading> {
  if (file.size > MAX_STATEMENT_BYTES)
    return fail('unsupported')
  return readStatementBytes(new Uint8Array(await file.arrayBuffer()), file.name)
}
