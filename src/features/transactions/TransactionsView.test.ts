import type { Category } from '@/db/schema'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { dismissToast } from '@/app/toast'
import { db } from '@/db/database'
import { setClock } from '@/db/records'
import { getDefaultAccount } from '@/db/repositories/accounts'
import { listCategories } from '@/db/repositories/categories'
import { addTransaction } from '@/db/repositories/transactions'
import { seedDefaults } from '@/db/seed'
import { testPlugins } from '@/test/plugins'
import TransactionsView from './TransactionsView.vue'

let expense: Category[]
let income: Category[]

let tick = 0

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  // A clock that moves on every call, so the creation order is certain.
  tick = 0
  setClock(() => new Date(Date.UTC(2026, 10, 5, 12, 0, tick++)))
  await seedDefaults()
  expense = await listCategories({ kind: 'expense' })
  income = await listCategories({ kind: 'income' })
})

afterEach(() => {
  dismissToast()
  setClock()
})

async function add(kind: 'expense' | 'income', amountCents: number, category: Category, date: string, note = '') {
  const account = await getDefaultAccount()
  await addTransaction({
    kind,
    amountCents,
    date,
    accountId: account!.id,
    categoryId: category.id,
    note,
  })
}

async function mountList(path = '/movimenti') {
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  const wrapper = mount(TransactionsView, {
    global: {
      plugins: testPlugins(router),
    },
  })
  await vi.waitFor(() => expect(wrapper.find('.transactions__days, .transactions__empty').exists()).toBe(true))
  await flushPromises()
  return { wrapper, router }
}

function titles(wrapper: Awaited<ReturnType<typeof mountList>>['wrapper']) {
  return wrapper.findAll('.transaction-row__title').map(title => title.text())
}

describe('transactionsView', () => {
  beforeEach(async () => {
    await add('expense', 1240, expense[0]!, '2026-11-05', 'Esselunga')
    await add('expense', 180, expense[2]!, '2026-11-05', 'Caffè')
    await add('income', 5000, income[1]!, '2026-11-04')
    await add('expense', 900, expense[4]!, '2026-10-30', 'Cinema')
  })

  it('groups by day, newest first, with the total of each day', async () => {
    const { wrapper } = await mountList()
    // Rows and category names come from two queries: wait for both.
    await vi.waitFor(() => expect(titles(wrapper)).toEqual([
      'Caffè',
      'Esselunga',
      'Rimborsi',
      'Cinema',
    ]))
    const totals = wrapper.findAll('.day-group__head .type-note').map(total => total.text())
    expect(totals).toEqual(['−14,20', '+50,00', '−9,00'])
  })

  it('combines the filters of the URL', async () => {
    const { wrapper } = await mountList(`/movimenti?tipo=uscite&dal=2026-11-01&al=2026-11-30&q=CAFFE`)
    await vi.waitFor(() => expect(titles(wrapper)).toEqual(['Caffè']))
    expect(wrapper.text()).toContain('Novembre 2026')
  })

  it('filters by several categories at once', async () => {
    const { wrapper } = await mountList(`/movimenti?categoria=${expense[0]!.id},${expense[4]!.id}`)
    await vi.waitFor(() => expect(titles(wrapper)).toEqual(['Esselunga', 'Cinema']))
  })

  it('tells when a search finds nothing', async () => {
    const { wrapper } = await mountList('/movimenti?q=pizza')
    await vi.waitFor(() => expect(wrapper.get('.transactions__empty').text()).toContain('Nessun risultato per «pizza».'))
  })
})

describe('transactionsView without transactions', () => {
  it('shows the empty state', async () => {
    const { wrapper } = await mountList()
    await vi.waitFor(() => expect(wrapper.get('.transactions__empty').text()).toContain('Nessun movimento.'))
  })
})
