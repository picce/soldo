import type { ObservabilitySet } from 'dexie'
import type { BackupFile } from './format'
import type { FakeDrive } from '@/test/fake-drive'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/database'
import { getDefaultAccount } from '@/db/repositories/accounts'
import { listCategories } from '@/db/repositories/categories'
import { setMeta } from '@/db/repositories/meta'
import { addTransaction } from '@/db/repositories/transactions'
import { seedDefaults } from '@/db/seed'
import { today } from '@/domain/dates'
import { createFakeDrive, fakeDriveFetch } from '@/test/fake-drive'
import {
  CHANGE_DELAY,
  completeConnection,
  keepDeviceData,
  markRestoredFromDrive,
  runBackup,
  startAutoBackup,
  stopAutoBackup,
} from './auto'
import { disableEncryption, enableEncryption } from './encryption'
import { resetGoogleAuth } from './google/auth'
import { forgetDriveFolder, googleDrive } from './google/drive'
import { gunzip, gzip } from './pack'
import { backupPending, backupState, patchBackupState, resetBackupState } from './state'

let drive: FakeDrive

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
  await setMeta('onboardedAt', '2026-11-05T08:00:00.000Z')
  drive = createFakeDrive()
  vi.stubGlobal('fetch', fakeDriveFetch(drive))
  resetGoogleAuth()
  forgetDriveFolder()
  resetBackupState()
  backupPending.value = false
  patchBackupState({ connected: true, account: 'anna@example.com' })
})

afterEach(() => {
  disableEncryption()
  stopAutoBackup()
  vi.useRealTimers()
  vi.restoreAllMocks()
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

async function uploaded(): Promise<BackupFile[]> {
  return Promise.all(drive.backups().map(async file => JSON.parse(await gunzip(file.bytes)) as BackupFile))
}

/** A backup another device left on the Drive. */
async function otherDeviceBackup(day: string) {
  return drive.addBackup({
    name: `soldo-backup-${day}.json.gz`,
    appProperties: {
      soldo: 'backup',
      day,
      exportedAt: `${day}T20:00:00.000Z`,
      transactions: '0',
      categories: '16',
      accounts: '1',
      checksum: 'b'.repeat(64),
    },
  }, await gzip('{}'))
}

describe('automatic backup', () => {
  it('does nothing while Drive is not connected, or before the first start', async () => {
    resetBackupState()
    expect(await runBackup()).toBe('skipped')
    patchBackupState({ connected: true })
    await db.meta.delete('onboardedAt')
    expect(await runBackup()).toBe('skipped')
    expect(drive.backups()).toEqual([])
  })

  it('uploads the data, then only when it changes, into one file per day', async () => {
    expect(await runBackup()).toBe('uploaded')
    const [first] = await uploaded()
    expect(first!.data.categories).toHaveLength(16)
    expect(backupState.value).toMatchObject({
      trusted: true,
      error: null,
      todayFile: {
        day: today(),
        id: drive.backups()[0]!.id,
      },
    })
    expect(backupState.value.lastBackupAt).toBe(first!.exportedAt)

    expect(await runBackup()).toBe('unchanged')
    // «Esegui backup ora» uploads anyway, in today's file.
    expect(await runBackup({ force: true })).toBe('uploaded')
    expect(drive.backups()).toHaveLength(1)

    await spend(1240)
    expect(await runBackup()).toBe('uploaded')
    const all = await uploaded()
    expect(all).toHaveLength(1)
    expect(all[0]!.data.transactions).toHaveLength(1)
  })

  it('encrypts what goes to Drive once the device has a passphrase, replacing today\'s file', async () => {
    expect(await runBackup()).toBe('uploaded')
    expect(await runBackup()).toBe('unchanged')
    await enableEncryption('correct horse battery', 10)
    // Same data, but the file of today is replaced by an encrypted one.
    expect(await runBackup()).toBe('uploaded')
    const [file, ...others] = drive.backups()
    expect(others).toEqual([])
    expect(file!.name).toBe(`soldo-backup-${today()}.soldo`)
    expect(file!.appProperties.encrypted).toBe('1')
    const [remote] = await googleDrive.list()
    expect(remote!.encrypted).toBe(true)

    const { readBackupBytes, unlockBackup } = await import('./import')
    const reading = await readBackupBytes(await googleDrive.download(remote!.id), remote!.name, remote!.checksum)
    if (reading.ok || reading.error !== 'locked')
      throw new Error('expected a locked backup')
    const opened = await unlockBackup(reading.locked, 'correct horse battery')
    expect(opened.ok && opened.backup.data.categories).toHaveLength(16)

    // Off again: the next file is plain, and says so.
    disableEncryption()
    expect(await runBackup()).toBe('uploaded')
    expect(drive.backups()[0]!.name).toBe(`soldo-backup-${today()}.json.gz`)
    expect((await googleDrive.list())[0]!.encrypted).toBe(false)
  })

  it('asks before writing over the backups of another device', async () => {
    await otherDeviceBackup('2026-11-01')
    expect(await runBackup()).toBe('choice')
    expect(backupState.value.choice).toBe(true)
    expect(drive.backups()).toHaveLength(1)
    // Until the user picks, nothing is written.
    expect(await runBackup()).toBe('skipped')

    expect(await keepDeviceData()).toBe('uploaded')
    expect(backupState.value).toMatchObject({ choice: false, trusted: true })
    expect(drive.backups()).toHaveLength(2)
  })

  it('keeps 14 days of backups and moves the older ones to the trash', async () => {
    patchBackupState({ trusted: true })
    for (let day = 10; day < 30; day++)
      await otherDeviceBackup(`2026-10-${day}`)
    expect(await runBackup()).toBe('uploaded')
    const kept = drive.backups().map(file => file.appProperties.day).sort()
    expect(kept).toHaveLength(14)
    expect(kept[0]).toBe('2026-10-17')
  })

  it('stops on an expired permission until Drive is connected again', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'revoked' }), { status: 401 })))
    expect(await runBackup()).toBe('auth')
    expect(backupState.value.error).toBe('auth')
    expect(backupPending.value).toBe(true)
    expect(await runBackup()).toBe('skipped')

    vi.stubGlobal('fetch', fakeDriveFetch(drive))
    await completeConnection()
    stopAutoBackup()
    expect(backupState.value.error).toBeNull()
    expect(await runBackup()).toBe('uploaded')
  })

  it('waits for the network without calling it an error', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(await runBackup()).toBe('offline')
    expect(backupPending.value).toBe(true)
    expect(backupState.value.error).toBeNull()
  })

  it('keeps the history of the same account and starts afresh with another', async () => {
    await runBackup()
    const { lastChecksum } = backupState.value
    await completeConnection()
    stopAutoBackup()
    expect(backupState.value).toMatchObject({ account: 'anna@example.com', lastChecksum, trusted: true })

    vi.spyOn(googleDrive, 'account').mockResolvedValue('bruno@example.com')
    await completeConnection()
    stopAutoBackup()
    expect(backupState.value).toMatchObject({
      account: 'bruno@example.com',
      lastChecksum: null,
      lastBackupAt: null,
      trusted: false,
    })
  })

  it('does not upload back a backup just restored from Drive', async () => {
    const backup = await otherDeviceBackup(today())
    await markRestoredFromDrive({
      id: backup.id,
      name: backup.name,
      day: today(),
      exportedAt: `${today()}T20:00:00.000Z`,
      transactions: 0,
      categories: 16,
      accounts: 1,
      checksum: 'b'.repeat(64),
    })
    expect(backupState.value).toMatchObject({
      trusted: true,
      todayFile: { id: backup.id },
    })
    expect(await runBackup()).toBe('unchanged')

    // The next change updates the restored file of today.
    await spend(500)
    expect(await runBackup()).toBe('uploaded')
    expect(drive.backups()).toHaveLength(1)
  })

  it('backs up after a quiet time following the changes', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout'],
    })
    startAutoBackup()
    const mutation = { [`idb://${db.name}/transactions/`]: {} } as unknown as ObservabilitySet
    Dexie.on.storagemutated.fire(mutation)
    expect(backupPending.value).toBe(true)
    vi.advanceTimersByTime(CHANGE_DELAY - 1)
    // A second change restarts the wait.
    Dexie.on.storagemutated.fire(mutation)
    vi.advanceTimersByTime(CHANGE_DELAY - 1)
    expect(drive.log).toEqual([])
    vi.advanceTimersByTime(1)
    vi.useRealTimers()
    await vi.waitFor(() => expect(drive.backups()).toHaveLength(1))
  })
})
