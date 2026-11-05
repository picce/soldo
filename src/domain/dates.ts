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
