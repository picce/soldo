import type { ImportedRow } from './types'
import { sha256Hex } from '@/backup/pack'
import { normalizeText } from '@/domain/search'

/**
 * The id that tells a movement already imported (docs/specs/import-da-file.md, "Lettura dei
 * file"): from date, amount and description, so two statements that overlap give the same
 * ids for the same movements, whatever the file format. Equal rows of the same file are
 * counted, so two equal coffees on the same day stay two.
 */
export async function externalIds(rows: readonly ImportedRow[]): Promise<string[]> {
  const seen = new Map<string, number>()
  return Promise.all(rows.map((row) => {
    const key = `${row.date}|${row.amountCents}|${normalizeText(row.description)}`
    const count = seen.get(key) ?? 0
    seen.set(key, count + 1)
    return sha256Hex(`${key}|${count}`).then(hash => `imp1:${hash.slice(0, 32)}`)
  }))
}
