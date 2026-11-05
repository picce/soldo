import { describe, expect, it } from 'vitest'
import { backupsToRemove, KEEP_DAYS, KEEP_MONTHS } from './retention'

/** A backup of `day`, written at `time` (UTC, enough to order them). */
function backup(day: string, time = '12:00') {
  return { id: `${day}T${time}`, day, exportedAt: `${day}T${time}:00.000Z` }
}

/** `count` consecutive days ending on 2026-11-05. */
function days(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(2026, 10, 5 - index))
    return backup(date.toISOString().slice(0, 10))
  })
}

describe('backupsToRemove', () => {
  it('keeps everything while there are few backups', () => {
    expect(backupsToRemove(days(KEEP_DAYS))).toEqual([])
  })

  it('keeps the newest backup of each day', () => {
    const morning = backup('2026-11-05', '08:00')
    const evening = backup('2026-11-05', '21:00')
    expect(backupsToRemove([morning, evening])).toEqual([morning])
  })

  it('keeps the last 14 days with a backup, then one per month', () => {
    const all = days(60)
    const removed = backupsToRemove(all).map(item => item.day)
    const kept = all.map(item => item.day).filter(day => !removed.includes(day))
    expect(kept).toEqual([
      // The last 14 days...
      ...all.slice(0, KEEP_DAYS).map(item => item.day),
      // ...and the newest of September (back to the 7th): November and October are in.
      '2026-09-30',
    ])
  })

  it('counts days among the backups, not on the calendar', () => {
    // A quiet month: two backups three weeks apart are both recent days.
    const sparse = [
      backup('2026-11-05'),
      backup('2026-10-15'),
    ]
    expect(backupsToRemove(sparse)).toEqual([])
  })

  it('keeps at most 12 months beyond the last days', () => {
    const monthly = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 10 - index, 1))
      return backup(date.toISOString().slice(0, 10))
    })
    // Monthly backups are also each a distinct day: 14 days, among them 12 months.
    expect(backupsToRemove(monthly)).toHaveLength(30 - Math.max(KEEP_DAYS, KEEP_MONTHS))
  })
})
