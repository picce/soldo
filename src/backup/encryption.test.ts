import { beforeEach, describe, expect, it } from 'vitest'
import { decryptBytes, encryptBytes } from './crypto'
import { backupEncryption, disableEncryption, enableEncryption, encryptionKey } from './encryption'
import { backupState, patchBackupState } from './state'

beforeEach(() => {
  disableEncryption()
})

describe('encryption on the device', () => {
  it('is off until a passphrase turns it on', async () => {
    expect(backupEncryption.value).toBeNull()
    expect(encryptionKey()).toBeUndefined()
    await enableEncryption('correct horse battery', 10)
    expect(backupEncryption.value?.since).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(localStorage.getItem('soldo.encryption')).not.toContain('correct horse')
  })

  it('keeps a key that files encrypted with it open with the passphrase', async () => {
    await enableEncryption('correct horse battery', 10)
    const sealed = await encryptBytes(new Uint8Array([1, 2, 3]), (await encryptionKey())!)
    const opened = await decryptBytes(sealed, 'correct horse battery')
    expect(Array.from(opened!.bytes)).toEqual([1, 2, 3])
  })

  it('makes the next backup go even if the data did not change', async () => {
    patchBackupState({ lastChecksum: 'abc' })
    await enableEncryption('correct horse battery', 10)
    expect(backupState.value.lastChecksum).toBeNull()
    patchBackupState({ lastChecksum: 'abc' })
    disableEncryption()
    expect(backupState.value.lastChecksum).toBeNull()
    expect(encryptionKey()).toBeUndefined()
    expect(localStorage.getItem('soldo.encryption')).toBeNull()
  })
})
