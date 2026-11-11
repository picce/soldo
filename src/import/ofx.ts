import type { ImportedRow } from './types'
import { decodeEntities, oneLine } from './text'
import { parseDate, parseSignedAmount } from './values'

/**
 * OFX and QFX statements (docs/specs/import-da-file.md), version 1 (SGML, tags often left
 * open) and 2 (XML): one movement per `STMTTRN`.
 */

export function isOfx(text: string): boolean {
  return /OFXHEADER|<OFX>/i.test(text.slice(0, 2000))
}

function field(block: string, tag: string): string {
  const match = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(block)
  return match
    ? decodeEntities(match[1]!).trim()
    : ''
}

export function readOfx(text: string): ImportedRow[] {
  const rows: ImportedRow[] = []
  const blocks = text.split(/<STMTTRN>/i).slice(1)
  blocks.forEach((raw, index) => {
    const block = raw.split(/<\/STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTRS>/i)[0]!
    const date = parseDate(field(block, 'DTPOSTED') || field(block, 'DTUSER'), 'ymd')
    const amountCents = parseSignedAmount(field(block, 'TRNAMT'))
    if (!date || !amountCents)
      return
    const name = field(block, 'NAME') || field(block, 'PAYEE')
    const memo = field(block, 'MEMO')
    const description = memo && !name.toLowerCase().includes(memo.toLowerCase())
      ? `${name} ${memo}`
      : name || memo
    rows.push({
      line: index + 1,
      date,
      amountCents,
      description: oneLine(description),
    })
  })
  return rows
}
