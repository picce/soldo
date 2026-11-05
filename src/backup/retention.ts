/**
 * Which backups to keep on Drive (docs/specs/backup-google-drive.md): the newest of each of
 * the last 14 days that have one, and the newest of each of the last 12 months. Days are
 * counted among the backups, not on the calendar: a week without changes loses nothing.
 */

export const KEEP_DAYS = 14
export const KEEP_MONTHS = 12

interface Dated {
  id: string
  /** `YYYY-MM-DD`. */
  day: string
  exportedAt: string
}

/** The backups to remove, newest first. */
export function backupsToRemove<T extends Dated>(backups: T[]): T[] {
  const newestFirst = [...backups].sort((a, b) => b.exportedAt.localeCompare(a.exportedAt))
  const days = new Set<string>()
  const months = new Set<string>()
  const keep = new Set<string>()
  for (const backup of newestFirst) {
    // The first backup met for a day (or a month) is its newest.
    if (!days.has(backup.day) && days.size < KEEP_DAYS) {
      days.add(backup.day)
      keep.add(backup.id)
    }
    const month = backup.day.slice(0, 7)
    if (!months.has(month) && months.size < KEEP_MONTHS) {
      months.add(month)
      keep.add(backup.id)
    }
  }
  return newestFirst.filter(backup => !keep.has(backup.id))
}
