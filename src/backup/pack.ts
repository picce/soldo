import type { BackupData, BackupFile } from './format'
import type { BackupSummary } from './provider'
import { encryptBytes } from './crypto'
import { encryptionKey } from './encryption'

/**
 * The backup file as it travels to Drive (docs/specs/backup-google-drive.md): the JSON of
 * Phase 2 compressed with gzip, and a checksum of the data that tells whether anything
 * changed since the last backup. No Zod here: packing does not load it.
 */

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** Runs bytes through a (de)compression stream, without Blob or Response (portable in tests). */
async function transform(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const reader = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  }).pipeThrough(stream).getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done)
      break
    chunks.push(value)
    length += value.length
  }
  const out = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

export function gzip(text: string): Promise<Uint8Array<ArrayBuffer>> {
  return transform(encoder.encode(text), new CompressionStream('gzip'))
}

export async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  return decoder.decode(await transform(bytes, new DecompressionStream('gzip')))
}

/** A gzip file starts with the bytes 1f 8b. */
export function isGzip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x1F && bytes[1] === 0x8B
}

/** SHA-256 of a text, hex. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Checksum of the data only: the export time changes at every backup, the data may not. */
export function checksumOf(data: BackupData): Promise<string> {
  return sha256Hex(JSON.stringify(data))
}

function alive(rows: { deletedAt: string | null }[]): number {
  return rows.filter(row => row.deletedAt === null).length
}

export async function summarize(backup: BackupFile): Promise<BackupSummary> {
  return {
    exportedAt: backup.exportedAt,
    transactions: alive(backup.data.transactions),
    categories: alive(backup.data.categories),
    accounts: alive(backup.data.accounts),
    checksum: await checksumOf(backup.data),
  }
}

/** The JSON of the backup, compressed. */
export function packBackup(backup: BackupFile): Promise<Uint8Array<ArrayBuffer>> {
  return gzip(JSON.stringify(backup))
}

/**
 * The file as it leaves the device: compressed and, when this device encrypts the backups
 * (docs/specs/backup-cifrati.md), encrypted.
 */
export async function sealBackup(backup: BackupFile): Promise<{ bytes: Uint8Array<ArrayBuffer>, encrypted: boolean }> {
  const packed = await packBackup(backup)
  const key = encryptionKey()
  return key
    ? { bytes: await encryptBytes(packed, await key), encrypted: true }
    : { bytes: packed, encrypted: false }
}
