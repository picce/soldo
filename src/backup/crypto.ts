/**
 * Encryption of the backup files with a passphrase (docs/specs/backup-cifrati.md,
 * "Crittografia"): PBKDF2-SHA-256 gives an AES-GCM key, and an encrypted file is a 41-byte
 * header followed by the ciphertext. Web Crypto only.
 */

const MAGIC = new TextEncoder().encode('SOLDOENC')
const VERSION = 1
const SALT_BYTES = 16
const IV_BYTES = 12
/** Magic, version, iterations, salt, IV. */
export const HEADER_BYTES = MAGIC.length + 1 + 4 + SALT_BYTES + IV_BYTES
/** OWASP 2023 for PBKDF2-SHA-256: about half a second on a phone, once per passphrase. */
export const PBKDF2_ITERATIONS = 600_000

/** A key ready to encrypt, with what is needed to derive it again from the passphrase. */
export interface BackupKey {
  key: CryptoKey
  salt: Uint8Array<ArrayBuffer>
  iterations: number
}

/** The file starts with the bytes of `SOLDOENC`. */
export function isEncrypted(bytes: Uint8Array): boolean {
  return bytes.length >= HEADER_BYTES && MAGIC.every((byte, index) => bytes[index] === byte)
}

export async function deriveBackupKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<BackupKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    material,
    { name: 'AES-GCM', length: 256 },
    // Extractable: the device keeps it in localStorage (encryption.ts).
    true,
    ['encrypt', 'decrypt'],
  )
  return { key, salt, iterations }
}

/** A key from a new passphrase, with a new salt. */
export function createBackupKey(passphrase: string, iterations = PBKDF2_ITERATIONS): Promise<BackupKey> {
  return deriveBackupKey(passphrase, crypto.getRandomValues(new Uint8Array(SALT_BYTES)), iterations)
}

function header(key: BackupKey, iv: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(HEADER_BYTES)
  bytes.set(MAGIC, 0)
  let offset = MAGIC.length
  bytes[offset++] = VERSION
  new DataView(bytes.buffer).setUint32(offset, key.iterations)
  offset += 4
  bytes.set(key.salt, offset)
  offset += SALT_BYTES
  bytes.set(iv, offset)
  return bytes
}

/** Encrypts with a new IV; the header is authenticated too, so a changed byte breaks the file. */
export async function encryptBytes(bytes: Uint8Array<ArrayBuffer>, key: BackupKey): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const head = header(key, iv)
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: head }, key.key, bytes))
  const out = new Uint8Array(HEADER_BYTES + sealed.length)
  out.set(head, 0)
  out.set(sealed, HEADER_BYTES)
  return out
}

interface Header {
  version: number
  iterations: number
  salt: Uint8Array<ArrayBuffer>
  iv: Uint8Array<ArrayBuffer>
}

function readHeader(bytes: Uint8Array<ArrayBuffer>): Header {
  let offset = MAGIC.length
  const version = bytes[offset++]!
  const iterations = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset)
  offset += 4
  const salt = bytes.slice(offset, offset + SALT_BYTES)
  offset += SALT_BYTES
  const iv = bytes.slice(offset, offset + IV_BYTES)
  return { version, iterations, salt, iv }
}

/**
 * Opens an encrypted file with the passphrase. `null` when it does not open: wrong
 * passphrase, changed bytes, or a version of the encryption this app does not know.
 */
export async function decryptBytes(bytes: Uint8Array<ArrayBuffer>, passphrase: string): Promise<{ bytes: Uint8Array<ArrayBuffer>, key: BackupKey } | null> {
  if (!isEncrypted(bytes))
    return null
  const { version, iterations, salt, iv } = readHeader(bytes)
  if (version !== VERSION || iterations < 1)
    return null
  const key = await deriveBackupKey(passphrase, salt, iterations)
  try {
    const plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: bytes.slice(0, HEADER_BYTES),
      },
      key.key,
      bytes.slice(HEADER_BYTES),
    )
    return {
      bytes: new Uint8Array(plain),
      key,
    }
  }
  catch {
    return null
  }
}
