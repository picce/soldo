import { beforeEach, describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'
import { db } from './database'
import { addTransaction, listTransactions } from './repositories/transactions'
import { useLiveQuery } from './useLiveQuery'

async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 50 && !check(); attempt++)
    await new Promise(resolve => setTimeout(resolve, 10))
  expect(check()).toBe(true)
}

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
})

describe('useLiveQuery', () => {
  it('updates when the data changes and stops with its scope', async () => {
    const scope = effectScope()
    const { data } = scope.run(() => useLiveQuery(() => listTransactions()))!
    await until(() => data.value?.length === 0)

    await addTransaction({
      kind: 'expense',
      amountCents: 100,
      date: '2026-11-05',
      accountId: 'a',
      categoryId: 'c',
      note: '',
    })
    await until(() => data.value?.length === 1)

    scope.stop()
    await addTransaction({
      kind: 'expense',
      amountCents: 200,
      date: '2026-11-05',
      accountId: 'a',
      categoryId: 'c',
      note: '',
    })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(data.value).toHaveLength(1)
  })

  it('runs again when a dependency changes', async () => {
    await addTransaction({
      kind: 'expense',
      amountCents: 100,
      date: '2026-10-05',
      accountId: 'a',
      categoryId: 'c',
      note: '',
    })
    await addTransaction({
      kind: 'expense',
      amountCents: 200,
      date: '2026-11-05',
      accountId: 'a',
      categoryId: 'c',
      note: '',
    })
    const month = ref('2026-11')

    const scope = effectScope()
    const { data } = scope.run(() => useLiveQuery(
      () => listTransactions({ from: `${month.value}-01`, to: `${month.value}-31` }),
      [month],
    ))!
    await until(() => data.value?.[0]?.amountCents === 200)

    month.value = '2026-10'
    await until(() => data.value?.[0]?.amountCents === 100)
    scope.stop()
  })
})
