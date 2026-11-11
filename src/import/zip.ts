import { transform } from '@/backup/pack'

/**
 * Just enough of the zip format to open an `.xlsx` (docs/specs/import-da-file.md): the
 * central directory, and the files stored or compressed with deflate. No zip64, no
 * encryption: an Excel sheet of a bank statement needs neither.
 */

export class ZipError extends Error {}

const END_OF_DIRECTORY = 0x06054B50
const DIRECTORY_ENTRY = 0x02014B50
const LOCAL_HEADER = 0x04034B50

export interface ZipEntry {
  name: string
  read: () => Promise<Uint8Array<ArrayBuffer>>
}

/** A zip starts with `PK\3\4`. */
export function isZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04
}

/** The files of a zip, by name; each is decompressed when read. */
export function readZip(bytes: Uint8Array<ArrayBuffer>): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // The end record is in the last 22 bytes, plus a comment of at most 65535.
  let end = -1
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 22 - 0xFFFF); offset--) {
    if (view.getUint32(offset, true) === END_OF_DIRECTORY) {
      end = offset
      break
    }
  }
  if (end < 0)
    throw new ZipError('No central directory')
  const count = view.getUint16(end + 10, true)
  let offset = view.getUint32(end + 16, true)
  const decoder = new TextDecoder()
  const entries = new Map<string, ZipEntry>()
  for (let index = 0; index < count; index++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== DIRECTORY_ENTRY)
      throw new ZipError('Broken central directory')
    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    offset += 46 + nameLength + extraLength + commentLength
    entries.set(name, {
      name,
      read: async () => {
        if (view.getUint32(localOffset, true) !== LOCAL_HEADER)
          throw new ZipError(`Broken entry ${name}`)
        const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true)
        const data = bytes.slice(start, start + compressedSize)
        if (method === 0)
          return data
        if (method === 8)
          return transform(data, new DecompressionStream('deflate-raw'))
        throw new ZipError(`Unknown compression ${method}`)
      },
    })
  }
  return entries
}
