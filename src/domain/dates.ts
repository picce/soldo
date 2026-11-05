import { addDays as addDaysToDate, format, isValid, parse } from 'date-fns'

/**
 * Calendar dates are local `YYYY-MM-DD` strings, never UTC timestamps: an expense made at
 * 23:30 belongs to that day wherever the device is.
 */
export type IsoDate = string

const ISO_DATE_FORMAT = 'yyyy-MM-dd'
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(value: string): boolean {
  return ISO_DATE_PATTERN.test(value) && isValid(parse(value, ISO_DATE_FORMAT, new Date()))
}

/** Local midnight of a calendar date. */
export function fromIsoDate(value: IsoDate): Date {
  if (!isIsoDate(value))
    throw new RangeError(`Not a calendar date: ${value}`)
  return parse(value, ISO_DATE_FORMAT, new Date())
}

/** Calendar date of a local `Date`. */
export function toIsoDate(date: Date): IsoDate {
  return format(date, ISO_DATE_FORMAT)
}

export function today(now: Date = new Date()): IsoDate {
  return toIsoDate(now)
}

export function addDays(value: IsoDate, days: number): IsoDate {
  return toIsoDate(addDaysToDate(fromIsoDate(value), days))
}

/** A calendar date formatted with Intl, e.g. `{ weekday: 'long', day: 'numeric', month: 'long' }`. */
export function formatDate(value: IsoDate, intlLocale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(intlLocale, options).format(fromIsoDate(value))
}

const TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** How long ago a timestamp was, in the largest whole unit: «3 giorni fa», «ieri», «ora». */
export function timeAgo(timestamp: string, intlLocale: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(timestamp).getTime()) / 1000))
  const format = new Intl.RelativeTimeFormat(intlLocale, { numeric: 'auto' })
  for (const [unit, size] of TIME_UNITS) {
    if (seconds >= size)
      return format.format(-Math.floor(seconds / size), unit)
  }
  return format.format(0, 'second')
}
