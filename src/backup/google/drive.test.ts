import type { BackupUpload } from '../provider'
import type { FakeDrive } from '@/test/fake-drive'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeDrive, fakeDriveFetch } from '@/test/fake-drive'
import { BackupProviderError } from '../provider'
import { accessToken, resetGoogleAuth } from './auth'
import { forgetDriveFolder, googleDrive } from './drive'

let drive: FakeDrive

beforeEach(() => {
  drive = createFakeDrive()
  vi.stubGlobal('fetch', fakeDriveFetch(drive))
  resetGoogleAuth()
  forgetDriveFolder()
})

function upload(day: string, extra: Partial<BackupUpload> = {}): BackupUpload {
  return {
    day,
    bytes: new Uint8Array([0x1F, 0x8B, 1, 2, 3, 0x0D, 0x0A, 255]),
    summary: {
      exportedAt: `${day}T20:00:00.000Z`,
      transactions: 12,
      categories: 16,
      accounts: 1,
      checksum: 'a'.repeat(64),
    },
    ...extra,
  }
}

async function codeOf(promise: Promise<unknown>) {
  const error = await promise.catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(BackupProviderError)
  return (error as BackupProviderError).code
}

describe('google drive provider', () => {
  it('creates the Soldo folder once and uploads a backup into it', async () => {
    const first = await googleDrive.upload(upload('2026-11-04'))
    await googleDrive.upload(upload('2026-11-05'))

    const folders = [
      ...drive.files.values(),
    ].filter(file => file.mimeType === 'application/vnd.google-apps.folder')
    expect(folders).toHaveLength(1)
    expect(folders[0]).toMatchObject({
      name: 'Soldo',
      appProperties: { soldo: 'folder' },
    })
    const stored = drive.files.get(first.id)!
    expect(stored).toMatchObject({
      name: 'soldo-backup-2026-11-04.json.gz',
      mimeType: 'application/gzip',
      parents: [folders[0]!.id],
      appProperties: {
        soldo: 'backup',
        format: '1',
        day: '2026-11-04',
        transactions: '12',
      },
    })
    // The bytes arrive as they are, line breaks and all.
    expect([...stored.bytes]).toEqual([0x1F, 0x8B, 1, 2, 3, 0x0D, 0x0A, 255])
    expect(first).toMatchObject({
      day: '2026-11-04',
      transactions: 12,
      categories: 16,
      accounts: 1,
    })
  })

  it('finds a folder created earlier, even by another device', async () => {
    await googleDrive.upload(upload('2026-11-04'))
    forgetDriveFolder()
    await googleDrive.upload(upload('2026-11-05'))
    expect(drive.log.filter(entry => entry === 'POST /drive/v3/files')).toHaveLength(1)
  })

  it('updates today\'s file, or adds one if the user deleted it', async () => {
    const today = await googleDrive.upload(upload('2026-11-05'))
    const again = await googleDrive.upload(upload('2026-11-05', {
      replaceId: today.id,
      summary: {
        ...upload('2026-11-05').summary,
        transactions: 13,
      },
    }))
    expect(again.id).toBe(today.id)
    expect(drive.backups()).toHaveLength(1)
    expect(drive.files.get(today.id)!.appProperties.transactions).toBe('13')

    drive.files.get(today.id)!.trashed = true
    const replaced = await googleDrive.upload(upload('2026-11-05', { replaceId: today.id }))
    expect(replaced.id).not.toBe(today.id)
    expect(drive.backups()).toHaveLength(1)
  })

  it('lists the backups newest first, over several pages', async () => {
    for (let day = 1; day <= 3; day++)
      await googleDrive.upload(upload(`2026-11-0${day}`))
    // A file without Soldo's properties is not a backup.
    drive.addBackup({
      name: 'altro.json.gz',
      appProperties: { soldo: 'backup' },
    }, new Uint8Array())
    const listed = await googleDrive.list()
    expect(listed.map(backup => backup.day)).toEqual(['2026-11-03', '2026-11-02', '2026-11-01'])
  })

  it('downloads a backup and moves an old one to the trash', async () => {
    const backup = await googleDrive.upload(upload('2026-11-05'))
    expect([
      ...await googleDrive.download(backup.id),
    ]).toEqual([
      ...upload('2026-11-05').bytes,
    ])
    await googleDrive.remove(backup.id)
    expect(drive.files.get(backup.id)!.trashed).toBe(true)
    expect(await googleDrive.list()).toEqual([])
  })

  it('tells the account', async () => {
    expect(await googleDrive.account()).toBe('anna@example.com')
  })

  it('renews the access token once after a 401', async () => {
    await accessToken()
    drive.queue({ status: 401 })
    expect(await googleDrive.account()).toBe('anna@example.com')
    expect(drive.tokens).toBe(2)

    drive.queue({ status: 401 })
    drive.queue({ status: 401 })
    expect(await codeOf(googleDrive.account())).toBe('auth')
  })

  it('names the errors that need the user, and the others', async () => {
    drive.queue(drive.error(403, 'storageQuotaExceeded'))
    expect(await codeOf(googleDrive.upload(upload('2026-11-05')))).toBe('quota')
    drive.queue(drive.error(403, 'insufficientFilePermissions'))
    expect(await codeOf(googleDrive.list())).toBe('auth')
    drive.queue(drive.error(429, 'userRateLimitExceeded'))
    expect(await codeOf(googleDrive.list())).toBe('unavailable')
  })

  it('reports a revoked sign-in and a missing network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'revoked' }), { status: 401 })))
    expect(await codeOf(googleDrive.list())).toBe('auth')
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))
    expect(await codeOf(googleDrive.list())).toBe('offline')
  })
})
