import { describe, expect, it } from 'vitest'
import { addDays, formatDate, fromIsoDate, isIsoDate, timeAgo, today, toIsoDate } from './dates'

describe('calendar dates', () => {
  it('validates YYYY-MM-DD strings that are real dates', () => {
    expect(isIsoDate('2026-11-05')).toBe(true)
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(isIsoDate('2026-02-29')).toBe(false)
    expect(isIsoDate('2026-1-5')).toBe(false)
    expect(isIsoDate('05/11/2026')).toBe(false)
  })

  it('converts to and from local dates without going through UTC', () => {
    const late = new Date(2026, 10, 5, 23, 30)
    expect(toIsoDate(late)).toBe('2026-11-05')
    expect(today(late)).toBe('2026-11-05')
    const parsed = fromIsoDate('2026-11-05')
    expect([
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate(),
      parsed.getHours(),
    ]).toEqual([2026, 10, 5, 0])
    expect(() => fromIsoDate('ieri')).toThrow(RangeError)
  })

  it('adds days across months, years and daylight saving changes', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-10-25', -1)).toBe('2026-10-24')
  })

  it('formats dates in each language', () => {
    const long = { weekday: 'long', day: 'numeric', month: 'long' } as const
    expect(formatDate('2026-11-05', 'it-IT', long)).toBe('giovedì 5 novembre')
    expect(formatDate('2026-11-05', 'en-GB', long)).toBe('Thursday 5 November')
  })
})

describe('timeAgo', () => {
  const now = new Date('2026-11-05T12:00:00.000Z')

  it('says how long ago, in the largest whole unit', () => {
    expect(timeAgo('2026-11-05T11:59:30.000Z', 'it-IT', now)).toBe('ora')
    expect(timeAgo('2026-11-05T11:58:00.000Z', 'it-IT', now)).toBe('2 minuti fa')
    expect(timeAgo('2026-11-05T07:00:00.000Z', 'it-IT', now)).toBe('5 ore fa')
    expect(timeAgo('2026-11-04T10:00:00.000Z', 'it-IT', now)).toBe('ieri')
    expect(timeAgo('2026-11-02T10:00:00.000Z', 'it-IT', now)).toBe('3 giorni fa')
    expect(timeAgo('2026-08-01T10:00:00.000Z', 'en-GB', now)).toBe('3 months ago')
  })

  it('treats a time in the future as now', () => {
    expect(timeAgo('2026-11-05T13:00:00.000Z', 'en-GB', now)).toBe('now')
  })
})
