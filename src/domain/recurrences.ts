import type { IsoDate } from './dates'
import type { Recurrence, RecurrenceFrequency } from '@/db/schema'
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarMonths,
} from 'date-fns'
import { fromIsoDate, toIsoDate } from './dates'

/**
 * Dates of a recurrence (docs/specs/released/ricorrenze.md, "Le date"). Occurrence `k` is always counted
 * from the start, never from the previous one, so the day does not drift: monthly from 31 January
 * gives 28 or 29 February and then 31 March again.
 */

export type RecurrenceSchedule = Pick<Recurrence, 'freq' | 'interval' | 'startDate' | 'endDate' | 'lastGeneratedDate'>

/** Highest «ogni N». */
export const MAX_INTERVAL = 99

/** Most occurrences added in one go: a daily series stopped for long catches up in later rounds. */
export const MAX_DUE = 1000

const STEP: Record<RecurrenceFrequency, (date: Date, amount: number) => Date> = {
  daily: addDays,
  weekly: addWeeks,
  monthly: addMonths,
  yearly: addYears,
}

export function isValidInterval(interval: number): boolean {
  return Number.isInteger(interval) && interval >= 1 && interval <= MAX_INTERVAL
}

/** Occurrence `k` of a schedule; `k = 0` is the start. */
export function occurrence(schedule: Pick<RecurrenceSchedule, 'freq' | 'interval' | 'startDate'>, k: number): IsoDate {
  return toIsoDate(STEP[schedule.freq](fromIsoDate(schedule.startDate), k * schedule.interval))
}

/**
 * The index of an occurrence at or before `date`, close to it: the search for the dates after
 * `date` starts there instead of from the start, which for an old daily series would be long.
 */
function firstIndexNear(schedule: Pick<RecurrenceSchedule, 'freq' | 'interval' | 'startDate'>, date: IsoDate): number {
  if (date <= schedule.startDate)
    return 0
  const start = fromIsoDate(schedule.startDate)
  const target = fromIsoDate(date)
  const units = {
    daily: () => differenceInCalendarDays(target, start),
    weekly: () => Math.floor(differenceInCalendarDays(target, start) / 7),
    monthly: () => differenceInCalendarMonths(target, start),
    yearly: () => Math.floor(differenceInCalendarMonths(target, start) / 12),
  }[schedule.freq]()
  // One step back: the end of the month can bring an occurrence a few days earlier than its unit.
  return Math.max(0, Math.floor(units / schedule.interval) - 1)
}

/** Dates after `after` (all of them, without it) up to `until` included, at most `limit`. */
function datesBetween(schedule: RecurrenceSchedule, after: IsoDate | undefined, until: IsoDate, limit: number): IsoDate[] {
  const last = schedule.endDate && schedule.endDate < until
    ? schedule.endDate
    : until
  const dates: IsoDate[] = []
  for (let k = after
    ? firstIndexNear(schedule, after)
    : 0; dates.length < limit; k++) {
    const date = occurrence(schedule, k)
    if (date > last)
      break
    if (!after || date > after)
      dates.push(date)
  }
  return dates
}

/** Dates to add now: after the last one added (from the start, if none), up to today and the end. */
export function dueOccurrences(schedule: RecurrenceSchedule, today: IsoDate, limit = MAX_DUE): IsoDate[] {
  return datesBetween(schedule, schedule.lastGeneratedDate, today, limit)
}

/** Dates still to come: after today and after the last one added, up to `until` and the end. */
export function nextOccurrences(schedule: RecurrenceSchedule, today: IsoDate, until: IsoDate, limit = MAX_DUE): IsoDate[] {
  const after = schedule.lastGeneratedDate && schedule.lastGeneratedDate > today
    ? schedule.lastGeneratedDate
    : today
  return datesBetween(schedule, after, until, limit)
}

/** The next date after today, or undefined for a series that is over. */
export function nextOccurrence(schedule: RecurrenceSchedule, today: IsoDate): IsoDate | undefined {
  return nextOccurrences(schedule, today, '9999-12-31', 1)[0]
}

/** A series is over when no date is left after today. */
export function isFinished(schedule: RecurrenceSchedule, today: IsoDate): boolean {
  return nextOccurrence(schedule, today) === undefined
}

/** Id of the transaction of a series on a day: the same rule and day never make two. */
export function occurrenceId(recurrenceId: string, date: IsoDate): string {
  return `${recurrenceId}:${date}`
}
