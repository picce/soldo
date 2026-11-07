import type { RecurrenceInput } from './recurrences'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../database'
import { setClock } from '../records'
import { seedDefaults } from '../seed'
import { AccountInUseError, createAccount, deleteAccount, getDefaultAccount } from './accounts'
import { CategoryInUseError, deleteCategory, listCategories } from './categories'
import { deletePaymentMethod, listPaymentMethods, PaymentMethodInUseError } from './payment-methods'
import {
  countRecurrenceUses,
  createRecurrence,
  deleteRecurrence,
  generateDueOccurrences,
  getRecurrence,
  listRecurrences,
  restoreRecurrence,
  resumeRecurrence,
  revertRecurrence,
  stopRecurrence,
  updateRecurrence,
} from './recurrences'
import { deleteTransaction, listTransactions } from './transactions'

let tick = 0

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
  tick = 0
  setClock(() => new Date(Date.UTC(2026, 10, 7, 8, 0, tick++)))
})

afterEach(() => setClock())

/** Rent: 750 € on the 1st of every month, paid by the first payment method. */
async function rent(changes: Partial<RecurrenceInput> = {}): Promise<RecurrenceInput> {
  const [home] = await listCategories({ kind: 'expense' })
  const [method] = await listPaymentMethods()
  return {
    template: {
      kind: 'expense',
      amountCents: 75000,
      accountId: method!.accountId,
      paymentMethodId: method!.id,
      categoryId: home!.id,
      note: 'Affitto',
    },
    freq: 'monthly',
    interval: 1,
    startDate: '2026-09-01',
    ...changes,
  }
}

async function dates() {
  return (await listTransactions()).map(transaction => transaction.date).sort()
}

describe('createRecurrence', () => {
  it('saves a series with its template, currency and payment method', async () => {
    const created = await createRecurrence(await rent())
    expect(await getRecurrence(created.id)).toMatchObject({
      template: {
        kind: 'expense',
        amountCents: 75000,
        currency: 'EUR',
        note: 'Affitto',
      },
      freq: 'monthly',
      interval: 1,
      startDate: '2026-09-01',
    })
    expect(created.template.paymentMethodId).toBeDefined()
    expect(created.template).not.toHaveProperty('toAccountId')
    expect(await listRecurrences()).toHaveLength(1)
  })

  it('refuses what a transaction would refuse, a bad interval and an end before the start', async () => {
    const input = await rent()
    await expect(createRecurrence({
      ...input,
      template: { ...input.template, amountCents: 0 },
    })).rejects.toThrow(RangeError)
    await expect(createRecurrence({
      ...input,
      template: { ...input.template, kind: 'income' },
    })).rejects.toThrow('payment method')
    await expect(createRecurrence({ ...input, interval: 0 })).rejects.toThrow(RangeError)
    await expect(createRecurrence({ ...input, interval: 100 })).rejects.toThrow(RangeError)
    await expect(createRecurrence({ ...input, endDate: '2026-08-31' })).rejects.toThrow(RangeError)
    expect(await listRecurrences()).toHaveLength(0)
  })
})

describe('generateDueOccurrences', () => {
  it('adds every day that is due, as a transaction of the series', async () => {
    const series = await createRecurrence(await rent())
    const added = await generateDueOccurrences('2026-11-07')
    expect(added.map(transaction => transaction.date)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01'])
    expect(added[0]).toMatchObject({
      id: `${series.id}:2026-09-01`,
      kind: 'expense',
      amountCents: 75000,
      note: 'Affitto',
      paymentMethodId: series.template.paymentMethodId,
      recurrenceId: series.id,
      occurrenceDate: '2026-09-01',
      source: 'recurring',
    })
    expect((await getRecurrence(series.id))!.lastGeneratedDate).toBe('2026-11-01')
  })

  it('never adds the same day twice, even after it was deleted or with two runs at once', async () => {
    const series = await createRecurrence(await rent())
    await generateDueOccurrences('2026-11-07')
    expect(await generateDueOccurrences('2026-11-07')).toEqual([])

    await deleteTransaction(`${series.id}:2026-10-01`)
    await db.recurrences.update(series.id, { lastGeneratedDate: undefined })
    expect(await generateDueOccurrences('2026-11-07')).toEqual([])
    expect(await dates()).toEqual(['2026-09-01', '2026-11-01'])

    const [first, second] = await Promise.all([
      generateDueOccurrences('2026-12-01'),
      generateDueOccurrences('2026-12-01'),
    ])
    expect([
      ...first!,
      ...second!,
    ].map(transaction => transaction.date)).toEqual(['2026-12-01'])
  })

  it('skips deleted series and adds nothing before the start', async () => {
    const later = await createRecurrence(await rent({ startDate: '2026-12-01' }))
    const gone = await createRecurrence(await rent())
    await deleteRecurrence(gone.id)
    expect(await generateDueOccurrences('2026-11-07')).toEqual([])
    expect((await getRecurrence(later.id))!.lastGeneratedDate).toBeUndefined()
  })

  it('makes transfers between the two accounts', async () => {
    const bank = await getDefaultAccount()
    const savings = await createAccount({
      name: 'Salvadanaio',
      icon: 'vault',
      color: 3,
      initialBalanceCents: 0,
    })
    await createRecurrence({
      template: {
        kind: 'transfer',
        amountCents: 20000,
        accountId: bank!.id,
        toAccountId: savings.id,
        categoryId: null,
        note: '',
      },
      freq: 'weekly',
      interval: 2,
      startDate: '2026-10-24',
    })
    const added = await generateDueOccurrences('2026-11-07')
    expect(added.map(({ date, toAccountId }) => [date, toAccountId])).toEqual([
      ['2026-10-24', savings.id],
      ['2026-11-07', savings.id],
    ])
  })
})

describe('changing a series', () => {
  it('changes the next transactions only', async () => {
    const series = await createRecurrence(await rent())
    await generateDueOccurrences('2026-11-07')
    const input = await rent()
    await updateRecurrence(series.id, {
      ...input,
      template: { ...input.template, amountCents: 80000 },
    }, '2026-11-07')
    await generateDueOccurrences('2026-12-01')
    expect((await listTransactions()).map(transaction => transaction.amountCents)).toEqual([80000, 75000, 75000, 75000])
  })

  it('does not fill the past in with a new calendar', async () => {
    const series = await createRecurrence(await rent())
    await generateDueOccurrences('2026-11-07')
    await updateRecurrence(series.id, await rent({ startDate: '2026-09-05' }), '2026-11-07')
    expect(await generateDueOccurrences('2026-11-07')).toEqual([])
    expect((await generateDueOccurrences('2026-12-05')).map(transaction => transaction.date)).toEqual(['2026-12-05'])
  })

  it('stops a series today, takes it up again from today on, and puts it back with «Annulla»', async () => {
    const series = await createRecurrence(await rent())
    await generateDueOccurrences('2026-11-07')
    const before = await stopRecurrence(series.id, '2026-11-07')
    expect(await generateDueOccurrences('2027-02-01')).toEqual([])

    await resumeRecurrence(series.id, '2027-02-15')
    expect((await getRecurrence(series.id))!.endDate).toBeUndefined()
    expect(await generateDueOccurrences('2027-02-15')).toEqual([])
    expect((await generateDueOccurrences('2027-03-01')).map(transaction => transaction.date)).toEqual(['2027-03-01'])

    await revertRecurrence(before)
    expect(await getRecurrence(series.id)).toMatchObject({ lastGeneratedDate: '2026-11-01' })
  })

  it('does not stop a series that has not started', async () => {
    const series = await createRecurrence(await rent({ startDate: '2026-12-01' }))
    await expect(stopRecurrence(series.id, '2026-11-07')).rejects.toThrow(RangeError)
  })

  it('deletes a series and keeps what it added; «Annulla» brings it back', async () => {
    const series = await createRecurrence(await rent())
    await generateDueOccurrences('2026-11-07')
    await deleteRecurrence(series.id)
    expect(await listRecurrences()).toEqual([])
    expect(await dates()).toHaveLength(3)
    await restoreRecurrence(series.id)
    expect(await getRecurrence(series.id)).toBeDefined()
  })
})

describe('what a series uses', () => {
  it('counts the series that use an account, a category or a payment method', async () => {
    const input = await rent()
    await createRecurrence(input)
    expect(await countRecurrenceUses({ accountId: input.template.accountId })).toBe(1)
    expect(await countRecurrenceUses({ categoryId: input.template.categoryId! })).toBe(1)
    expect(await countRecurrenceUses({ paymentMethodId: input.template.paymentMethodId! })).toBe(1)
    expect(await countRecurrenceUses({ categoryId: 'other' })).toBe(0)
  })

  it('keeps them from being deleted', async () => {
    const savings = await createAccount({
      name: 'Salvadanaio',
      icon: 'vault',
      color: 3,
      initialBalanceCents: 0,
    })
    const input = await rent()
    const [, other] = await listPaymentMethods()
    await createRecurrence({
      ...input,
      template: { ...input.template, accountId: savings.id, paymentMethodId: other!.id },
    })
    await expect(deleteAccount(savings.id)).rejects.toThrow(AccountInUseError)
    await expect(deleteCategory(input.template.categoryId!)).rejects.toThrow(CategoryInUseError)
    await expect(deletePaymentMethod(other!.id)).rejects.toThrow(PaymentMethodInUseError)
  })
})
