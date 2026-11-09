import type { ServiceId } from './services'
import type { FakeCloud } from '@/test/fake-cloud'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/database'
import { getDefaultAccount } from '@/db/repositories/accounts'
import { listCategories } from '@/db/repositories/categories'
import { setMeta } from '@/db/repositories/meta'
import { addTransaction } from '@/db/repositories/transactions'
import { seedDefaults } from '@/db/seed'
import { today } from '@/domain/dates'
import { createFakeCloud, fakeCloudFetch } from '@/test/fake-cloud'
import { backupProvider, completeConnection, disconnectDrive, runBackup, stopAutoBackup } from './auto'
import { disableEncryption, enableEncryption } from './encryption'
import { readBackupBytes, unlockBackup } from './import'
import { gunzip } from './pack'
import { serviceAuths } from './services'
import { backupState, resetBackupState } from './state'

/** The engine on Dropbox and OneDrive (docs/specs/backup-dropbox-onedrive.md), on fake APIs. */

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
  await setMeta('onboardedAt', '2026-11-05T08:00:00.000Z')
  resetBackupState()
})

afterEach(() => {
  stopAutoBackup()
  disableEncryption()
  for (const auth of Object.values(serviceAuths))
    auth.reset()
})

async function spend(amountCents: number) {
  const account = await getDefaultAccount()
  const [groceries] = await listCategories({ kind: 'expense' })
  await addTransaction({
    kind: 'expense',
    amountCents,
    date: today(),
    accountId: account!.id,
    categoryId: groceries!.id,
    note: '',
  })
}

describe.each<ServiceId & ('dropbox' | 'onedrive')>(['dropbox', 'onedrive'])('backup on %s', (service) => {
  let cloud: FakeCloud

  beforeEach(async () => {
    cloud = createFakeCloud(service)
    vi.stubGlobal('fetch', fakeCloudFetch(cloud))
    await completeConnection(service)
    stopAutoBackup()
  })

  it('connects with the account and backs up into one file per day', async () => {
    expect(backupState.value).toMatchObject({ connected: true, service, account: 'anna@example.com' })
    expect(await runBackup()).toBe('uploaded')
    expect(await runBackup()).toBe('unchanged')
    await spend(1240)
    expect(await runBackup()).toBe('uploaded')
    expect(cloud.backups()).toEqual([`soldo-backup-${today()}.json.gz`])
    const backup = JSON.parse(await gunzip(cloud.files.get(cloud.backups()[0]!)!.bytes)) as { data: { transactions: unknown[] } }
    expect(backup.data.transactions).toHaveLength(1)

    const [remote] = await backupProvider().list()
    expect(remote).toMatchObject({
      day: today(),
      transactions: 1,
    })
    const reading = await readBackupBytes(await backupProvider().download(remote!.id), remote!.name, remote!.checksum)
    expect(reading.ok).toBe(true)
  })

  it('encrypts there too, replacing today\'s file', async () => {
    expect(await runBackup()).toBe('uploaded')
    await enableEncryption('correct horse battery', 10)
    expect(await runBackup()).toBe('uploaded')
    expect(cloud.backups()).toEqual([`soldo-backup-${today()}.soldo`])
    const [remote] = await backupProvider().list()
    expect(remote!.encrypted).toBe(true)
    const reading = await readBackupBytes(await backupProvider().download(remote!.id), remote!.name, remote!.checksum)
    if (reading.ok || reading.error !== 'locked')
      throw new Error('expected a locked backup')
    expect((await unlockBackup(reading.locked, 'correct horse battery')).ok).toBe(true)
  })

  it('asks to sign in again when the permission is gone', async () => {
    cloud.revoke()
    expect(await runBackup()).toBe('auth')
    expect(backupState.value.error).toBe('auth')
  })

  it('disconnects from that service only', async () => {
    await disconnectDrive()
    expect(cloud.log).toContain(`POST soldo.test/api/${service}/disconnect`)
    expect(backupState.value.connected).toBe(false)
  })
})

describe('backup services', () => {
  it('starts afresh when another service is connected', async () => {
    const dropbox = createFakeCloud('dropbox')
    vi.stubGlobal('fetch', fakeCloudFetch(dropbox))
    await completeConnection('dropbox')
    stopAutoBackup()
    expect(await runBackup()).toBe('uploaded')
    expect(backupState.value.lastBackupAt).not.toBeNull()

    const onedrive = createFakeCloud('onedrive')
    vi.stubGlobal('fetch', fakeCloudFetch(onedrive))
    await completeConnection('onedrive')
    stopAutoBackup()
    // Same account name, other service: nothing of Dropbox's history carries over.
    expect(backupState.value).toMatchObject({ service: 'onedrive', lastBackupAt: null, trusted: false })
  })
})
