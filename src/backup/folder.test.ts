import type { FolderStore } from './folder'
import { describe, expect, it } from 'vitest'
import { folderProvider, INDEX_NAME } from './folder'

/** A folder in memory, as Dropbox or OneDrive would hold it. */
function memoryStore() {
  const files = new Map<string, { bytes: Uint8Array<ArrayBuffer>, modifiedAt: string }>()
  let clock = 0
  const store: FolderStore = {
    account: async () => 'anna@example.com',
    list: async () => [...files].map(([name, file]) => ({ name, modifiedAt: file.modifiedAt })),
    read: async name => files.get(name)?.bytes ?? null,
    write: async (name, bytes) => {
      files.set(name, {
        bytes,
        modifiedAt: new Date(Date.UTC(2026, 10, 9, 8, 0, clock++)).toISOString(),
      })
    },
    remove: async (name) => {
      files.delete(name)
    },
  }
  return { store, files }
}

function summary(exportedAt: string, transactions = 3) {
  return {
    exportedAt,
    transactions,
    categories: 16,
    accounts: 1,
    checksum: 'c'.repeat(64),
  }
}

const bytes = new Uint8Array([1, 2, 3])

describe('backups in a folder', () => {
  it('keeps the summary of each backup in an index, newest first', async () => {
    const { store, files } = memoryStore()
    const provider = folderProvider(store)
    await provider.upload({
      day: '2026-11-08',
      bytes,
      summary: summary('2026-11-08T20:00:00.000Z'),
    })
    const today = await provider.upload({
      day: '2026-11-09',
      bytes,
      summary: summary('2026-11-09T20:00:00.000Z', 5),
    })
    expect(today).toMatchObject({
      id: 'soldo-backup-2026-11-09.json.gz',
      day: '2026-11-09',
      transactions: 5,
      encrypted: false,
    })
    expect([
      ...files.keys(),
    ].sort()).toEqual(['soldo-backup-2026-11-08.json.gz', 'soldo-backup-2026-11-09.json.gz', INDEX_NAME])
    expect((await provider.list()).map(backup => [backup.day, backup.transactions])).toEqual([
      ['2026-11-09', 5],
      ['2026-11-08', 3],
    ])
    expect(Array.from(await provider.download(today.id))).toEqual([1, 2, 3])
  })

  it('still lists a file missing from the index, and ignores an entry without its file', async () => {
    const { store, files } = memoryStore()
    const provider = folderProvider(store)
    await provider.upload({
      day: '2026-11-08',
      bytes,
      summary: summary('2026-11-08T20:00:00.000Z'),
    })
    files.delete('soldo-backup-2026-11-08.json.gz')
    await store.write('soldo-backup-2026-11-07.soldo', bytes, 'application/octet-stream')
    await store.write('notes.txt', bytes, 'text/plain')
    const [only, ...others] = await provider.list()
    expect(others).toEqual([])
    expect(only).toMatchObject({
      day: '2026-11-07',
      transactions: 0,
      checksum: '',
      encrypted: true,
    })
  })

  it('replaces today\'s file when the encryption changes its name, and removes from the index', async () => {
    const { store, files } = memoryStore()
    const provider = folderProvider(store)
    const plain = await provider.upload({
      day: '2026-11-09',
      bytes,
      summary: summary('2026-11-09T08:00:00.000Z'),
    })
    const sealed = await provider.upload({
      day: '2026-11-09',
      bytes,
      summary: {
        ...summary('2026-11-09T09:00:00.000Z'),
        encrypted: true,
      },
      replaceId: plain.id,
    })
    expect(sealed.id).toBe('soldo-backup-2026-11-09.soldo')
    expect([
      ...files.keys(),
    ].sort()).toEqual(['soldo-backup-2026-11-09.soldo', INDEX_NAME])
    await provider.remove(sealed.id)
    expect(await provider.list()).toEqual([])
    expect(JSON.parse(new TextDecoder().decode(files.get(INDEX_NAME)!.bytes))).toEqual({ version: 1, backups: {} })
  })

  it('rebuilds a broken index', async () => {
    const { store } = memoryStore()
    await store.write(INDEX_NAME, new TextEncoder().encode('{oops'), 'application/json')
    const provider = folderProvider(store)
    await provider.upload({
      day: '2026-11-09',
      bytes,
      summary: summary('2026-11-09T08:00:00.000Z'),
    })
    expect((await provider.list())[0]!.transactions).toBe(3)
  })
})
