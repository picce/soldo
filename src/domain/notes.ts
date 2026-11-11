import { normalizeText } from './search'

/**
 * The notes used most often, for the note field of the quick add
 * (docs/specs/aggiunta-meno-tocchi.md): one tap instead of typing «Esselunga» again.
 */

/**
 * The most used among `notes`, which come newest first. Notes that differ only by case or
 * accents count as one, shown as it was last written. Most used first, then most recent.
 * With a `query`, only the notes that hold every word of it, and never the query itself.
 */
export function frequentNotes(notes: readonly string[], query = '', limit = 8): string[] {
  const groups = new Map<string, { text: string, count: number, first: number }>()
  notes.forEach((note, index) => {
    const key = normalizeText(note)
    if (!key)
      return
    const group = groups.get(key)
    if (group) {
      group.count++
    }
    else {
      groups.set(key, {
        text: note.trim(),
        count: 1,
        first: index,
      })
    }
  })
  const typed = normalizeText(query)
  const words = typed.split(' ').filter(Boolean)
  return [...groups]
    .filter(([key]) => key !== typed && words.every(word => key.includes(word)))
    .sort(([, a], [, b]) => b.count - a.count || a.first - b.first)
    .slice(0, limit)
    .map(([, group]) => group.text)
}
