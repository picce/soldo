import type { ImportedRow } from './types'
import { oneLine } from './text'
import { detectDateFormat, parseDate, parseSignedAmount } from './values'

/**
 * QIF statements (docs/specs/import-da-file.md): one field per line, a letter and its value,
 * movements closed by `^`. Dates in the format that reads them all.
 */

export function isQif(text: string): boolean {
  return /^!Type:/im.test(text.slice(0, 500))
}

interface QifRecord {
  line: number
  date: string
  amount: string
  payee: string
  memo: string
}

export function readQif(text: string): ImportedRow[] {
  const records: QifRecord[] = []
  let current: QifRecord = {
    line: 1,
    date: '',
    amount: '',
    payee: '',
    memo: '',
  }
  for (const line of text.split(/\r?\n/)) {
    const code = line[0]
    const value = line.slice(1).trim()
    if (code === '!')
      continue
    if (code === '^') {
      if (current.date || current.amount)
        records.push(current)
      current = {
        line: records.length + 1,
        date: '',
        amount: '',
        payee: '',
        memo: '',
      }
    }
    else if (code === 'D') {
      current.date = value
    }
    else if (code === 'T' || (code === 'U' && !current.amount)) {
      current.amount = value
    }
    else if (code === 'P') {
      current.payee = value
    }
    else if (code === 'M') {
      current.memo = value
    }
  }
  if (current.date && current.amount)
    records.push(current)

  const format = detectDateFormat(records.map(record => record.date)) ?? 'dmy'
  const rows: ImportedRow[] = []
  for (const record of records) {
    const date = parseDate(record.date, format)
    const amountCents = parseSignedAmount(record.amount)
    if (!date || !amountCents)
      continue
    const description = record.memo && !record.payee.toLowerCase().includes(record.memo.toLowerCase())
      ? `${record.payee} ${record.memo}`
      : record.payee || record.memo
    rows.push({
      line: record.line,
      date,
      amountCents,
      description: oneLine(description),
    })
  }
  return rows
}
