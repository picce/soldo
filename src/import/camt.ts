import type { ImportedRow } from './types'
import { oneLine } from './text'
import { parseDate, parseSignedAmount } from './values'
import { element, elements, parseXml, text } from './xml'

/**
 * CAMT.053 statements (ISO 20022, docs/specs/import-da-file.md): one movement per `Ntry`,
 * money out when `CdtDbtInd` is `DBIT`. Entries still pending are left out.
 */

export function isCamt(content: string): boolean {
  return /camt\.05[234]|<BkToCstmrStmt|<BkToCstmrAcctRpt/.test(content.slice(0, 5000))
}

/** Null when the XML cannot be read. */
export function readCamt(content: string): ImportedRow[] | null {
  const document = parseXml(content)
  if (!document)
    return null
  const rows: ImportedRow[] = []
  elements(document, 'Ntry').forEach((entry, index) => {
    if (/PDNG|INFO/.test(text(entry, 'Sts')))
      return
    const booked = element(entry, 'BookgDt') ?? element(entry, 'ValDt')
    const date = booked && parseDate(text(booked, 'Dt') || text(booked, 'DtTm'), 'ymd')
    const amount = parseSignedAmount(text(entry, 'Amt'))
    if (!date || !amount)
      return
    const debit = text(entry, 'CdtDbtInd') === 'DBIT'
    const amountCents = debit
      ? -Math.abs(amount)
      : Math.abs(amount)
    const counterpart = text(entry, 'RltdPties', debit ? 'Cdtr' : 'Dbtr', 'Nm')
    const remittance = elements(entry, 'Ustrd').map(node => node.textContent?.trim() ?? '').filter(Boolean).join(' ')
    const parts = [counterpart, remittance].filter(Boolean)
    const description = parts.length
      ? parts.join(' ')
      : text(entry, 'AddtlNtryInf') || text(entry, 'AddtlTxInf')
    rows.push({
      line: index + 1,
      date,
      amountCents,
      description: oneLine(description),
    })
  })
  return rows
}
