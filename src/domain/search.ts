/**
 * Search of Movimenti (docs/specs/released/movimenti.md): case and accents do not matter, so
 * "caffe" finds "Caffè" and "ESSELUNGA" finds "Esselunga".
 */

/** Lowercase, without diacritics, with single spaces. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** True when every word of the query appears in one of the fields (an empty query matches all). */
export function matchesSearch(query: string, fields: readonly string[]): boolean {
  const words = normalizeText(query).split(' ').filter(Boolean)
  if (!words.length)
    return true
  const haystack = fields.map(normalizeText).join(' ')
  return words.every(word => haystack.includes(word))
}
