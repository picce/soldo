import type { IsoDate } from './dates'
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns'
import { fromIsoDate, toIsoDate } from './dates'

export type PeriodUnit = 'day' | 'week' | 'month' | 'year'

/** A period of the Home: its unit and any date inside it. */
export interface Period {
  unit: PeriodUnit
  anchor: IsoDate
}

/** Both ends included. */
export interface DateRange {
  from: IsoDate
  to: IsoDate
}

/** Weeks start on Monday in both app languages. */
const WEEK_OPTIONS = { weekStartsOn: 1 } as const

export function periodRange({ unit, anchor }: Period): DateRange {
  const date = fromIsoDate(anchor)
  switch (unit) {
    case 'day':
      return { from: anchor, to: anchor }
    case 'week':
      return {
        from: toIsoDate(startOfWeek(date, WEEK_OPTIONS)),
        to: toIsoDate(endOfWeek(date, WEEK_OPTIONS)),
      }
    case 'month':
      return {
        from: toIsoDate(startOfMonth(date)),
        to: toIsoDate(endOfMonth(date)),
      }
    case 'year':
      return {
        from: toIsoDate(startOfYear(date)),
        to: toIsoDate(endOfYear(date)),
      }
  }
}

/** The period `step` units before (negative) or after (positive); the anchor moves to its first day. */
export function shiftPeriod(period: Period, step: number): Period {
  const start = fromIsoDate(periodRange(period).from)
  const shifted = {
    day: addDays,
    week: addWeeks,
    month: addMonths,
    year: addYears,
  }[period.unit](start, step)
  return {
    unit: period.unit,
    anchor: toIsoDate(shifted),
  }
}

export function isInPeriod(date: IsoDate, period: Period): boolean {
  const { from, to } = periodRange(period)
  return date >= from && date <= to
}

function capitalize(text: string, intlLocale: string): string {
  return text.charAt(0).toLocaleUpperCase(intlLocale) + text.slice(1)
}

/** Title of a period: «5 novembre 2026», «2-8 novembre», «Novembre 2026», «2026». */
export function periodLabel(period: Period, intlLocale: string): string {
  const { from, to } = periodRange(period)
  const start = fromIsoDate(from)
  switch (period.unit) {
    case 'day':
      return new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'long', year: 'numeric' }).format(start)
    case 'week': {
      // Built by hand: formatRange zero-pads the days in Italian ("02–08 novembre").
      const end = fromIsoDate(to)
      const dayMonth = new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'long' })
      return start.getMonth() === end.getMonth()
        ? `${start.getDate()}–${dayMonth.format(end)}`
        : `${dayMonth.format(start)} – ${dayMonth.format(end)}`
    }
    case 'month':
      return capitalize(new Intl.DateTimeFormat(intlLocale, { month: 'long', year: 'numeric' }).format(start), intlLocale)
    case 'year':
      return String(start.getFullYear())
  }
}
