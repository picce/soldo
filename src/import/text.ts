/**
 * From the bytes of a text file to its text (docs/specs/released/import-da-file.md): UTF-8, UTF-16 with
 * its mark, and otherwise Windows-1252, which is what an Italian home banking writes when it
 * does not write UTF-8 (`è` as a single byte).
 */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xFF && bytes[1] === 0xFE)
    return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  if (bytes[0] === 0xFE && bytes[1] === 0xFF)
    return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  const body = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF
    ? bytes.subarray(3)
    : bytes
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body)
  }
  catch {
    return new TextDecoder('windows-1252').decode(body)
  }
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: '\'',
  nbsp: ' ',
}

/** `&amp;`, `&#232;` and the like, in the texts of OFX files (which are not XML). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const value = code[1] === 'x' || code[1] === 'X'
        ? Number.parseInt(code.slice(2), 16)
        : Number.parseInt(code.slice(1), 10)
      return Number.isFinite(value) && value > 0
        ? String.fromCodePoint(value)
        : match
    }
    return ENTITIES[code.toLowerCase()] ?? match
  })
}

/** One line, single spaces, at most `max` characters: how a description becomes a note. */
export function oneLine(text: string, max = 200): string {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > max
    ? line.slice(0, max).trimEnd()
    : line
}
