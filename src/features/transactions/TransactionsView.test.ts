import type { Category } from '@/db/schema'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { dismissToast } from '@/app/toast'
import { db } from '@/db/database'
import { setClock } from '@/db/records'
import { archiveAccount, createAccount, getDefaultAccount } from '@/db/repositories/accounts'
import { listCategories } from '@/db/repositories/categories'
import { listPaymentMethods } from '@/db/repositories/payment-methods'
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

describe('accounts and payment methods', () => {
  const BANK = {
    name: 'Banca',
    icon: 'bank',
    color: 7,
    initialBalanceCents: 0,
  } as const

  function rows(wrapper: Awaited<ReturnType<typeof mountList>>['wrapper']) {
    return wrapper.findAll('.transaction-row').map(row => row.text().replace(/\s+/g, ' '))
  }

  async function card() {
    return (await listPaymentMethods()).find(method => method.preset === 'card')!
  }

  it('shows the payment method of an expense instead of its account', async () => {
    const account = (await getDefaultAccount())!
    await addTransaction({
      kind: 'expense',
      amountCents: 1240,
      date: '2026-11-05',
      accountId: account.id,
      categoryId: expense[0]!.id,
      note: 'Esselunga',
      paymentMethodId: (await card()).id,
    })
    const { wrapper } = await mountList()
    await vi.waitFor(() => expect(rows(wrapper)).toEqual(['EsselungaSpesa · Carta−12,40']))
  })

  it('draws a transfer with both accounts and an amount with no sign, out of the day total', async () => {
    const account = (await getDefaultAccount())!
    const bank = await createAccount(BANK)
    await addTransaction({
      kind: 'transfer',
      amountCents: 10000,
      date: '2026-11-05',
      accountId: bank.id,
      toAccountId: account.id,
      categoryId: null,
      note: '',
    })
    await add('expense', 500, expense[0]!, '2026-11-05')
    const { wrapper } = await mountList()
    await vi.waitFor(() => expect(rows(wrapper)).toHaveLength(2))
    expect(rows(wrapper)).toContain('TrasferimentoBanca → Contanti100,00')
    expect(wrapper.text()).toContain('−5,00')
    expect(wrapper.text()).not.toContain('−105,00')
  })

  it('keeps the name of an archived account', async () => {
    const bank = await createAccount(BANK)
    await addTransaction({
      kind: 'income',
      amountCents: 1000,
      date: '2026-11-05',
      accountId: bank.id,
      categoryId: income[0]!.id,
      note: '',
    })
    await archiveAccount(bank.id)
    const { wrapper } = await mountList()
    await vi.waitFor(() => expect(rows(wrapper)[0]).toContain('Banca'))
  })

  it('filters by payment method, leaving out what has none', async () => {
    const account = (await getDefaultAccount())!
    const method = await card()
    await addTransaction({
      kind: 'expense',
      amountCents: 100,
      date: '2026-11-05',
      accountId: account.id,
      categoryId: expense[0]!.id,
      note: 'Con carta',
      paymentMethodId: method.id,
    })
    await add('expense', 200, expense[0]!, '2026-11-05', 'Senza')
    await add('income', 300, income[0]!, '2026-11-05', 'Entrata')
    const { wrapper } = await mountList(`/movimenti?pagamento=${method.id}`)
    await vi.waitFor(() => expect(rows(wrapper)).toHaveLength(1))
    expect(rows(wrapper)[0]).toContain('Con carta')
  })

  it('filters transfers, which only then hide the other filters', async () => {
    const account = (await getDefaultAccount())!
    const bank = await createAccount(BANK)
    await addTransaction({
      kind: 'transfer',
      amountCents: 100,
      date: '2026-11-05',
      accountId: bank.id,
      toAccountId: account.id,
      categoryId: null,
      note: '',
    })
    await add('expense', 200, expense[0]!, '2026-11-05')
    const { wrapper } = await mountList('/movimenti?tipo=trasferimenti')
    await vi.waitFor(() => expect(rows(wrapper)).toHaveLength(1))
    const chips = wrapper.findAll('.transactions__filters button').map(item => item.text())
    expect(chips).toContain('Trasferimenti')
    expect(chips).not.toContain('Categoria')
    expect(chips).not.toContain('Pagamento')
  })

  it('offers the transfers filter only when there is something to find', async () => {
    await add('expense', 200, expense[0]!, '2026-11-05')
    const single = await mountList()
    await vi.waitFor(() => expect(rows(single.wrapper)).toHaveLength(1))
    expect(single.wrapper.findAll('.transactions__filters button').map(item => item.text())).not.toContain('Trasferimenti')
  })

  it('finds a payment method, and the accounts only of transfers', async () => {
    const account = (await getDefaultAccount())!
    const bank = await createAccount(BANK)
    await addTransaction({
      kind: 'expense',
      amountCents: 100,
      date: '2026-11-05',
      accountId: account.id,
      categoryId: expense[0]!.id,
      note: 'Con carta',
      paymentMethodId: (await card()).id,
    })
    await addTransaction({
      kind: 'transfer',
      amountCents: 200,
      date: '2026-11-05',
      accountId: bank.id,
      toAccountId: account.id,
      categoryId: null,
      note: 'Prelievo',
    })
    await add('expense', 300, expense[0]!, '2026-11-05', 'Senza pagamento')

    const byMethod = await mountList('/movimenti?q=carta')
    await vi.waitFor(() => expect(rows(byMethod.wrapper)).toHaveLength(1))
    expect(rows(byMethod.wrapper)[0]).toContain('Con carta')
    byMethod.wrapper.unmount()

    const byAccount = await mountList('/movimenti?q=banca')
    await vi.waitFor(() => expect(rows(byAccount.wrapper)).toHaveLength(1))
    expect(rows(byAccount.wrapper)[0]).toContain('Prelievo')
  })
})
