import { describe, expect, it } from 'vitest'
import { createBackupKey, decryptBytes, encryptBytes, HEADER_BYTES, isEncrypted } from './crypto'
import { gzip } from './pack'

// A few iterations: the real 600,000 would make each test wait.
const ITERATIONS = 10

const plain = new TextEncoder().encode('{"app":"soldo"}')

describe('backup encryption', () => {
  it('opens with the same passphrase what it encrypted', async () => {
    const key = await createBackupKey('correct horse battery', ITERATIONS)
    const sealed = await encryptBytes(plain, key)
    expect(isEncrypted(sealed)).toBe(true)
    expect(sealed.length).toBe(HEADER_BYTES + plain.length + 16)
    const opened = await decryptBytes(sealed, 'correct horse battery')
    expect(new TextDecoder().decode(opened!.bytes)).toBe('{"app":"soldo"}')
    // The key that opened it is the same, salt and iterations included.
    expect(opened!.key.iterations).toBe(ITERATIONS)
    expect(opened!.key.salt).toEqual(key.salt)
  })

  it('does not open with another passphrase', async () => {
    const sealed = await encryptBytes(plain, await createBackupKey('correct horse battery', ITERATIONS))
    expect(await decryptBytes(sealed, 'Correct horse battery')).toBeNull()
  })

  it('uses a new IV for every file, so two files of the same data differ', async () => {
    const key = await createBackupKey('correct horse battery', ITERATIONS)
    const first = await encryptBytes(plain, key)
    const second = await encryptBytes(plain, key)
    expect(first).not.toEqual(second)
  })

  it('does not open a file with a changed byte, in the header or in the data', async () => {
    const sealed = await encryptBytes(plain, await createBackupKey('correct horse battery', ITERATIONS))
    for (const index of [12, 20, HEADER_BYTES + 2]) {
      const changed = sealed.slice()
      changed[index]! ^= 1
      expect(await decryptBytes(changed, 'correct horse battery')).toBeNull()
    }
  })

  it('tells encrypted files from plain and compressed ones', async () => {
    expect(isEncrypted(plain)).toBe(false)
    expect(isEncrypted(await gzip('{"app":"soldo"}'))).toBe(false)
    expect(isEncrypted(new TextEncoder().encode('SOLDOENC'))).toBe(false)
  })
})
