import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/database'
import { setClock } from '@/db/records'
import { seedDefaults } from '@/db/seed'
import { createBackup } from './export'
import { readBackupBytes } from './import'
import { checksumOf, gunzip, gzip, isGzip, packBackup, summarize } from './pack'

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  setClock(() => new Date(Date.UTC(2026, 10, 5, 20, 0)))
  await seedDefaults()
  setClock()
})

describe('pack', () => {
  it('compresses and decompresses a text', async () => {
    const text = JSON.stringify({
      note: 'Caffè ☕',
      amounts: Array.from({ length: 200 }, (_, index) => index),
    })
    const bytes = await gzip(text)
    expect(isGzip(bytes)).toBe(true)
    expect(bytes.length).toBeLessThan(text.length)
    expect(await gunzip(bytes)).toBe(text)
    expect(isGzip(new TextEncoder().encode('{"app":"soldo"}'))).toBe(false)
  })

  it('gives the same checksum to the same data, whenever it is exported', async () => {
    const first = await createBackup()
    setClock(() => new Date(Date.UTC(2026, 11, 1)))
    const second = await createBackup()
    setClock()
    expect(second.exportedAt).not.toBe(first.exportedAt)
    expect(await checksumOf(second.data)).toBe(await checksumOf(first.data))
    expect(await checksumOf({ ...first.data, categories: [] })).not.toBe(await checksumOf(first.data))
  })

  it('packs a backup that the restore reads, with a summary of what it holds', async () => {
    const backup = await createBackup()
    const [bytes, summary] = await Promise.all([
      packBackup(backup),
      summarize(backup),
    ])
    expect(summary).toMatchObject({
      exportedAt: backup.exportedAt,
      transactions: 0,
      categories: 16,
      accounts: 1,
    })
    expect(summary.checksum).toMatch(/^[0-9a-f]{64}$/)

    const reading = await readBackupBytes(bytes, 'soldo-backup-2026-11-05.json.gz', summary.checksum)
    expect(reading.ok).toBe(true)
    // Data changed on the way does not pass the checksum.
    const other = await readBackupBytes(bytes, 'soldo-backup-2026-11-05.json.gz', '0'.repeat(64))
    expect(other).toEqual({ ok: false, error: 'invalid' })
  })
})
