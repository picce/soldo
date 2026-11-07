import type { Recurrence, RecurrenceTemplate, Transaction } from '../schema'
import { addDays, isIsoDate } from '@/domain/dates'
import { isValidAmountCents } from '@/domain/money'
import { dueOccurrences, isValidInterval, occurrenceId } from '@/domain/recurrences'
import { db } from '../database'
import { newRecord, now } from '../records'
import { DEFAULT_CURRENCY, RECURRENCE_FREQUENCIES } from '../schema'
import { validateKind } from './transactions'

/** What the user chooses for a series (docs/specs/ricorrenze.md); the currency defaults to EUR. */
export interface RecurrenceInput {
  template: Omit<RecurrenceTemplate, 'currency'> & Partial<Pick<RecurrenceTemplate, 'currency'>>
  freq: Recurrence['freq']
  interval: number
  startDate: string
  endDate?: string
}

type Schedule = Pick<Recurrence, 'freq' | 'interval' | 'startDate' | 'endDate'>

function validate({ template, freq, interval, startDate, endDate }: Pick<Recurrence, 'template'> & Schedule) {
  if (!isValidAmountCents(template.amountCents))
    throw new RangeError(`Invalid amount: ${template.amountCents}`)
  validateKind(template)
  if (!RECURRENCE_FREQUENCIES.includes(freq))
    throw new RangeError(`Invalid frequency: ${freq}`)
  if (!isValidInterval(interval))
    throw new RangeError(`Invalid interval: ${interval}`)
  if (!isIsoDate(startDate))
    throw new RangeError(`Invalid start: ${startDate}`)
  if (endDate !== undefined && (!isIsoDate(endDate) || endDate < startDate))
    throw new RangeError(`Invalid end: ${endDate}`)
}

/** The template as stored: currency set, and no key for what the kind does not have. */
function templateOf(input: RecurrenceInput['template']): RecurrenceTemplate {
  const { toAccountId, paymentMethodId, ...rest } = input
  return {
    currency: DEFAULT_CURRENCY,
    ...rest,
    ...(toAccountId
      ? { toAccountId }
      : {}),
    ...(paymentMethodId
      ? { paymentMethodId }
      : {}),
  }
}

/** Series not deleted, oldest first. */
export async function listRecurrences(): Promise<Recurrence[]> {
  const rows = await db.recurrences.filter(recurrence => recurrence.deletedAt === null).toArray()
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** The series, unless it does not exist or was deleted. */
export async function getRecurrence(id: string): Promise<Recurrence | undefined> {
  const recurrence = await db.recurrences.get(id)
  return recurrence?.deletedAt === null
    ? recurrence
    : undefined
}

async function requireRecurrence(id: string): Promise<Recurrence> {
  const recurrence = await getRecurrence(id)
  if (!recurrence)
    throw new Error(`Recurrence not found: ${id}`)
  return recurrence
}

export async function createRecurrence(input: RecurrenceInput): Promise<Recurrence> {
  const recurrence: Recurrence = {
    ...newRecord(),
    template: templateOf(input.template),
    freq: input.freq,
    interval: input.interval,
    startDate: input.startDate,
    ...(input.endDate
      ? { endDate: input.endDate }
      : {}),
  }
  validate(recurrence)
  await db.recurrences.add(recurrence)
  return recurrence
}

/**
 * Changes template and calendar; the transactions already added stay as they are. With a new
 * calendar, the days up to today are not filled in again: the next transaction comes after today.
 */
export async function updateRecurrence(id: string, input: RecurrenceInput, today: string): Promise<void> {
  await db.transaction('rw', db.recurrences, async () => {
    const current = await requireRecurrence(id)
    const { lastGeneratedDate, ...rest } = current
    const next: Recurrence = {
      ...rest,
      template: templateOf(input.template),
      freq: input.freq,
      interval: input.interval,
      startDate: input.startDate,
      ...(input.endDate
        ? { endDate: input.endDate }
        : {}),
      updatedAt: now(),
    }
    validate(next)
    const rescheduled = current.freq !== next.freq || current.interval !== next.interval || current.startDate !== next.startDate
    const last = rescheduled && lastGeneratedDate && lastGeneratedDate < today
      ? today
      : lastGeneratedDate
    await db.recurrences.put(last
      ? { ...next, lastGeneratedDate: last }
      : next)
  })
}

/** Ends a started series today; returns it as it was, for «Annulla» (`revertRecurrence`). */
export async function stopRecurrence(id: string, today: string): Promise<Recurrence> {
  return db.transaction('rw', db.recurrences, async () => {
    const current = await requireRecurrence(id)
    if (current.startDate > today)
      throw new RangeError('A series that has not started is deleted, not stopped')
    await db.recurrences.update(id, {
      endDate: today,
      updatedAt: now(),
    })
    return current
  })
}

/**
 * Takes a series up again with no end. The days it was stopped are not filled in: the next
 * transaction comes from today on.
 */
export async function resumeRecurrence(id: string, today: string): Promise<Recurrence> {
  return db.transaction('rw', db.recurrences, async () => {
    const current = await requireRecurrence(id)
    const { endDate: _ended, ...rest } = current
    const yesterday = addDays(today, -1)
    await db.recurrences.put({
      ...rest,
      lastGeneratedDate: current.lastGeneratedDate && current.lastGeneratedDate > yesterday
        ? current.lastGeneratedDate
        : yesterday,
      updatedAt: now(),
    })
    return current
  })
}

/** Puts a series back as it was before a change («Annulla»). */
export async function revertRecurrence(previous: Recurrence): Promise<void> {
  await db.recurrences.put({
    ...previous,
    updatedAt: now(),
  })
}

/** Soft delete: the series stops, the transactions it added stay. */
export async function deleteRecurrence(id: string): Promise<void> {
  const timestamp = now()
  await db.recurrences.update(id, { deletedAt: timestamp, updatedAt: timestamp })
}

export async function restoreRecurrence(id: string): Promise<void> {
  await db.recurrences.update(id, {
    deletedAt: null,
    updatedAt: now(),
  })
}

/**
 * Adds the transactions of every series that are due by `today`, and returns them. Each one has
 * the id of its series and day: one that exists already, deleted too, is not added again. One
 * transaction over both tables, so two tabs at once do not add the same day twice.
 */
export async function generateDueOccurrences(today: string): Promise<Transaction[]> {
  return db.transaction('rw', db.recurrences, db.transactions, async () => {
    const recurrences = await db.recurrences.filter(recurrence => recurrence.deletedAt === null).toArray()
    const added: Transaction[] = []
    for (const recurrence of recurrences) {
      const dates = dueOccurrences(recurrence, today)
      if (!dates.length)
        continue
      const ids = dates.map(date => occurrenceId(recurrence.id, date))
      const existing = await db.transactions.bulkGet(ids)
      const timestamp = now()
      const rows = dates.flatMap((date, index): Transaction[] => existing[index]
        ? []
        : [
            {
              id: ids[index]!,
              createdAt: timestamp,
              updatedAt: timestamp,
              deletedAt: null,
              ...recurrence.template,
              date,
              occurrenceDate: date,
              recurrenceId: recurrence.id,
              source: 'recurring',
            },
          ])
      await db.transactions.bulkAdd(rows)
      await db.recurrences.update(recurrence.id, {
        lastGeneratedDate: dates.at(-1),
        updatedAt: timestamp,
      })
      added.push(...rows)
    }
    return added
  })
}

export interface RecurrenceUse {
  accountId?: string
  categoryId?: string
  paymentMethodId?: string
}

/** Series not deleted whose template uses the account (on either side), category or payment method. */
export async function countRecurrenceUses(use: RecurrenceUse): Promise<number> {
  return db.recurrences
    .filter(({ deletedAt, template }) => deletedAt === null && (
      (use.accountId !== undefined && (template.accountId === use.accountId || template.toAccountId === use.accountId))
      || (use.categoryId !== undefined && template.categoryId === use.categoryId)
      || (use.paymentMethodId !== undefined && template.paymentMethodId === use.paymentMethodId)
    ))
    .count()
}
