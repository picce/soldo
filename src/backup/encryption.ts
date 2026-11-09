import type { BackupKey } from './crypto'
import { readonly, shallowRef } from 'vue'
import { now } from '@/db/records'
import { createBackupKey } from './crypto'
import { patchBackupState } from './state'

/**
 * The encryption of the backups on this device (docs/specs/backup-cifrati.md, "Chiave sul
 * telefono"). The key derived from the passphrase lives in localStorage, never the
 * passphrase: the automatic backup encrypts without asking. Not in the database, so it does
 * not travel inside the backups. Keeping it in clear on the device takes nothing away: the
 * data on the device is in clear too; the encryption protects what leaves it.
 */

interface StoredEncryption {
  /** Raw AES-GCM key, base64. */
  key: string
  /** PBKDF2 salt, base64: written in each file, so the passphrase opens it anywhere. */
  salt: string
  iterations: number
  /** When it was turned on (or adopted from a restored backup), ISO 8601. */
  since: string
}

export interface BackupEncryption {
  since: string
}

export const ENCRYPTION_KEY = 'soldo.encryption'

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), char => char.charCodeAt(0))
}

function load(): StoredEncryption | null {
  try {
    const stored = localStorage.getItem(ENCRYPTION_KEY)
    if (!stored)
      return null
    const value = JSON.parse(stored) as Partial<StoredEncryption>
    return typeof value.key === 'string' && typeof value.salt === 'string' && typeof value.iterations === 'number' && typeof value.since === 'string'
      ? value as StoredEncryption
      : null
  }
  catch {
    return null
  }
}

const stored = shallowRef<StoredEncryption | null>(load())
const state = shallowRef<BackupEncryption | null>(stored.value && { since: stored.value.since })
let imported: { from: StoredEncryption, key: Promise<BackupKey> } | undefined

/** Another tab (the installed app and the browser) changed it: follow. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === ENCRYPTION_KEY)
      set(load())
  })
}

function set(next: StoredEncryption | null): void {
  stored.value = next
  state.value = next && { since: next.since }
}

/** Encryption on this device: `null` when off. */
export const backupEncryption = readonly(state)

function save(next: StoredEncryption | null): void {
  set(next)
  try {
    if (next)
      localStorage.setItem(ENCRYPTION_KEY, JSON.stringify(next))
    else
      localStorage.removeItem(ENCRYPTION_KEY)
  }
  catch {
    // Storage full or blocked: it lasts for this session.
  }
  // The next backup goes even if the data did not change, and replaces today's file.
  patchBackupState({ lastChecksum: null })
}

/** The key to encrypt with, or `undefined` when encryption is off. */
export function encryptionKey(): Promise<BackupKey> | undefined {
  const current = stored.value
  if (!current)
    return undefined
  if (imported?.from !== current) {
    imported = {
      from: current,
      key: crypto.subtle.importKey('raw', fromBase64(current.key), 'AES-GCM', true, ['encrypt', 'decrypt'])
        .then(key => ({
          key,
          salt: fromBase64(current.salt),
          iterations: current.iterations,
        })),
    }
  }
  return imported.key
}

/** Keeps a key on this device: from a new passphrase, or from a restored backup. */
export async function adoptEncryption(key: BackupKey): Promise<void> {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key.key))
  save({
    key: toBase64(raw),
    salt: toBase64(key.salt),
    iterations: key.iterations,
    since: now(),
  })
}

/** Turns encryption on, or changes the passphrase. `iterations` only for tests. */
export async function enableEncryption(passphrase: string, iterations?: number): Promise<void> {
  await adoptEncryption(await createBackupKey(passphrase, iterations))
}

export function disableEncryption(): void {
  save(null)
}
