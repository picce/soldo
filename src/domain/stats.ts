import type { IsoDate } from './dates'
import type { DateRange } from './periods'
import type { Transaction } from '@/db/schema'
import { addMonths, addYears, differenceInCalendarDays, getDaysInMonth } from 'date-fns'
import { monthOf, monthRange, shiftMonth } from './budgets'
import { fromIsoDate, toIsoDate } from './dates'

/**
 * Figures of the Statistics (docs/specs/released/statistiche.md): a month or a year, compared with the one
 * before at the same point. Transfers are neither income nor expenses and never count.
 */

export type StatsUnit = 'month' | 'year'

/** A month `YYYY-MM` or a year `YYYY`. */
export interface StatsPeriod {
  unit: StatsUnit
  key: string
}

type Row = Pick<Transaction, 'kind' | 'amountCents' | 'categoryId' | 'date'>

export function isYear(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}$/.test(value)
}

/** The whole period, both ends included. */
export function statsRange({ unit, key }: StatsPeriod): DateRange {
  return unit === 'month'
    ? monthRange(key)
    : { from: `${key}-01-01`, to: `${key}-12-31` }
}

/** The period that contains `date`. */
export function statsPeriodOf(unit: StatsUnit, date: IsoDate): StatsPeriod {
  return {
    unit,
    key: unit === 'month'
      ? monthOf(date)
      : date.slice(0, 4),
  }
}

export function shiftStatsPeriod({ unit, key }: StatsPeriod, steps: number): StatsPeriod {
  return {
    unit,
    key: unit === 'month'
      ? shiftMonth(key, steps)
      : String(Number(key) + steps),
  }
}

export function isCurrentPeriod(period: StatsPeriod, today: IsoDate): boolean {
  const { from, to } = statsRange(period)
  return today >= from && today <= to
}

/** What counts of the period: up to today for the current one, all of it otherwise. */
export function countedRange(period: StatsPeriod, today: IsoDate): DateRange {
  const range = statsRange(period)
  return isCurrentPeriod(period, today)
    ? { from: range.from, to: today }
    : range
}

/**
 * The period before, to compare with: for the current period it stops at the same point
 * (7 November against 1–7 October, 31 March against all of February, 7 November 2026 against
 * 1 January–7 November 2025); a past one is compared whole.
 */
export function previousRange(period: StatsPeriod, today: IsoDate): DateRange {
  const before = statsRange(shiftStatsPeriod(period, -1))
  if (!isCurrentPeriod(period, today))
    return before
  const shift = period.unit === 'month'
    ? addMonths
    : addYears
  return {
    from: before.from,
    to: toIsoDate(shift(fromIsoDate(today), -1)),
  }
}

export function inRange(date: IsoDate, { from, to }: DateRange): boolean {
  return date >= from && date <= to
}

export interface Totals {
  incomeCents: number
  expenseCents: number
}

export function totals(rows: Row[], range: DateRange): Totals {
  let incomeCents = 0
  let expenseCents = 0
  for (const row of rows) {
    if (row.kind === 'transfer' || !inRange(row.date, range))
      continue
    if (row.kind === 'income')
      incomeCents += row.amountCents
    else
      expenseCents += row.amountCents
  }
  return { incomeCents, expenseCents }
}

export interface Change {
  deltaCents: number
  /** Rounded; null when there was nothing before. */
  percent: number | null
}

export function change(currentCents: number, previousCents: number): Change {
  return {
    deltaCents: currentCents - previousCents,
    percent: previousCents > 0
      ? Math.round(((currentCents - previousCents) / previousCents) * 100)
      : null,
  }
}

export function daysIn({ from, to }: DateRange): number {
  return differenceInCalendarDays(fromIsoDate(to), fromIsoDate(from)) + 1
}

export function monthsIn({ from, to }: DateRange): number {
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1
}

/** Expenses per day or per month of the counted part, rounded to the cent. */
export function average(cents: number, units: number): number {
  return units > 0
    ? Math.round(cents / units)
    : 0
}

/**
 * Expenses summed day by day through a month: one value per day, up to `until` (included) if it
 * falls inside the month, up to its last day otherwise.
 */
export function cumulativeByDay(rows: Row[], month: string, until?: IsoDate): number[] {
  const days = getDaysInMonth(fromIsoDate(`${month}-01`))
  const last = until && monthOf(until) === month
    ? Number(until.slice(8, 10))
    : days
  const perDay = Array.from<number>({ length: last }).fill(0)
  for (const row of rows) {
    if (row.kind !== 'expense' || monthOf(row.date) !== month)
      continue
    const day = Number(row.date.slice(8, 10))
    if (day <= last)
      perDay[day - 1]! += row.amountCents
  }
  let sum = 0
  return perDay.map(cents => (sum += cents))
}

export interface MonthTotals extends Totals {
  month: string
}

/** Income and expenses of each month of a year. */
export function monthByMonth(rows: Row[], year: string): MonthTotals[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`
    return {
      month,
      ...totals(rows, monthRange(month)),
    }
  })
}

export interface CategoryChange extends Change {
  categoryId: string
  cents: number
  previousCents: number
}

/**
 * Categories of one kind in the period, from the largest, each with what it was in the period
 * before. One with nothing now but something before is left out: the list is about this period.
 */
export function categoryChanges(rows: Row[], kind: 'expense' | 'income', current: DateRange, previous: DateRange): CategoryChange[] {
  const now = new Map<string, number>()
  const before = new Map<string, number>()
  for (const row of rows) {
    if (row.kind !== kind || !row.categoryId)
      continue
    const target = inRange(row.date, current)
      ? now
      : inRange(row.date, previous)
        ? before
        : undefined
    target?.set(row.categoryId, (target.get(row.categoryId) ?? 0) + row.amountCents)
  }
  return [
    ...now.entries(),
  ]
    .map(([categoryId, cents]) => {
      const previousCents = before.get(categoryId) ?? 0
      return {
        categoryId,
        cents,
        previousCents,
        ...change(cents, previousCents),
      }
    })
    .sort((a, b) => b.cents - a.cents)
}

export interface CategoryTrend {
  months: { month: string, cents: number }[]
  /** Average of the finished months since the first transaction; null when there is none. */
  averageCents: number | null
}

/**
 * One category over the 12 months that end with `endMonth`. The average leaves out the month
 * still running and those before the category's first transaction, so a new category does not
 * look cheaper for the months it did not exist. `rows` are all the transactions of the category.
 */
export function categoryTrend(rows: Row[], endMonth: string, today: IsoDate): CategoryTrend {
  const first = rows.reduce<string | undefined>((min, row) => !min || row.date < min
    ? row.date
    : min, undefined)
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = shiftMonth(endMonth, index - 11)
    const range = monthRange(month)
    const cents = rows.reduce((sum, row) => inRange(row.date, range) && row.kind !== 'transfer'
      ? sum + row.amountCents
      : sum, 0)
    return { month, cents }
  })
  const counted = months.filter(({ month }) => first !== undefined && monthRange(month).to < today && month >= monthOf(first))
  return {
    months,
    averageCents: counted.length
      ? average(counted.reduce((sum, { cents }) => sum + cents, 0), counted.length)
      : null,
  }
}

/** A round step for an axis: 1, 2 or 5 times a power of ten, so that `ticks` steps cover `max`. */
export function niceStep(max: number, ticks = 3): number {
  if (max <= 0)
    return 1
  const raw = max / ticks
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].find(factor => factor * power >= raw)!
  return step * power
}
