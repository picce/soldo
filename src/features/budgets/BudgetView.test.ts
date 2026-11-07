import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { db } from '@/db/database'
import { getDefaultAccount } from '@/db/repositories/accounts'
import { setBudget } from '@/db/repositories/budgets'
import { listCategories } from '@/db/repositories/categories'
import { addTransaction } from '@/db/repositories/transactions'
import { seedDefaults } from '@/db/seed'
import { testPlugins } from '@/test/plugins'
import BudgetView from './BudgetView.vue'

beforeEach(async () => {
  vi.useFakeTimers({
    toFake: ['Date'],
  })
  vi.setSystemTime(new Date(2026, 10, 7, 10))
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
})

afterEach(() => vi.useRealTimers())

async function category(index: number) {
  return (await listCategories({ kind: 'expense' }))[index]!
}

async function spend(amountCents: number, categoryIndex: number, date = '2026-11-05') {
  await addTransaction({
    kind: 'expense',
    amountCents,
    date,
    accountId: (await getDefaultAccount())!.id,
    categoryId: (await category(categoryIndex)).id,
    note: '',
  })
}

async function mountBudget(path = '/budget') {
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  const wrapper = mount(BudgetView, {
    global: {
      plugins: testPlugins(router),
    },
    attachTo: document.body,
  })
  await vi.waitFor(() => expect(wrapper.find('.budget__empty, .budget-card').exists()).toBe(true))
  await flushPromises()
  return { wrapper, router }
}

function clean(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

describe('budgetView', () => {
  it('explains what a budget is for when there is none', async () => {
    const { wrapper } = await mountBudget()
    expect(wrapper.get('h2').text()).toBe('Novembre 2026')
    expect(wrapper.text()).toContain('Decidi quanto spendere')
    expect(wrapper.find('.action-bar').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows the month: what is left, the bar, each category and the expenses without budget', async () => {
    await setBudget({
      month: '2026-11',
      categoryId: null,
      amountCents: 100000,
      repeat: true,
    })
    await setBudget({
      month: '2026-11',
      categoryId: (await category(0)).id,
      amountCents: 25000,
      repeat: true,
    })
    await setBudget({
      month: '2026-11',
      categoryId: (await category(2)).id,
      amountCents: 20000,
      repeat: true,
    })
    await spend(18240, 0)
    await spend(17200, 2)
    await spend(32560, 1)

    const { wrapper } = await mountBudget()
    const card = clean(wrapper.get('.budget-card').text())
    expect(card).toContain('320,00 €')
    expect(card).toContain('restano')
    expect(card).toContain('Spesi 680,00 € di 1.000,00 €')
    expect(card).toContain('68%')
    expect(card).toContain('Mancano 24 giorni: 13,33 € al giorno')

    const rows = wrapper.findAll('.budget-row').map(row => clean(row.text()))
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('Spesa')
    expect(rows[0]).toContain('182,40 € di 250,00 €')
    expect(rows[0]).toMatch(/67,60\s*restano/)
    expect(rows[1]).toContain('Ristoranti')
    expect(rows[1]).toContain('86%')
    expect(wrapper.get('.budget-rows__rest').text()).toMatch(/^Senza budget\s*325,60/)

    const meter = wrapper.get('.budget-row [role="meter"]')
    expect(meter.attributes('aria-valuetext')).toBe('72% usato')
    expect(meter.attributes('aria-label')).toBe('Budget di Spesa')
    wrapper.unmount()
  })

  it('says how much a budget is over', async () => {
    await setBudget({
      month: '2026-11',
      categoryId: (await category(4)).id,
      amountCents: 8000,
      repeat: true,
    })
    await spend(9650, 4)
    const { wrapper } = await mountBudget()
    const row = clean(wrapper.get('.budget-row').text())
    expect(row).toMatch(/16,50\s*oltre/)
    expect(row).toContain('120%')
    expect(clean(wrapper.get('.budget-row [role="meter"]').attributes('aria-valuetext')!)).toBe('120% usato, oltre di 16,50 €')
    expect(wrapper.text()).toContain('Imposta il budget del mese')
    wrapper.unmount()
  })

  it('repeats a budget into the next month, without the daily figure of the current one', async () => {
    await setBudget({
      month: '2026-10',
      categoryId: null,
      amountCents: 100000,
      repeat: true,
    })
    const { wrapper } = await mountBudget('/budget?mese=2026-12')
    expect(wrapper.get('h2').text()).toBe('Dicembre 2026')
    expect(clean(wrapper.get('.budget-card').text())).toContain('1.000,00 €')
    expect(wrapper.text()).not.toContain('al giorno')
    wrapper.unmount()
  })

  it('moves between months in the address', async () => {
    const { wrapper, router } = await mountBudget()
    await wrapper.get('button[aria-label="Periodo precedente"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.mese).toBe('2026-10'))
    await vi.waitFor(() => expect(wrapper.get('h2').text()).toBe('Ottobre 2026'))
    wrapper.unmount()
  })

  it('offers only what has no budget yet, and opens it', async () => {
    await setBudget({
      month: '2026-11',
      categoryId: (await category(0)).id,
      amountCents: 25000,
      repeat: true,
    })
    const { wrapper, router } = await mountBudget()
    const titles = wrapper.findAll('.choice-list__row').map(row => row.text())
    expect(titles[0]).toBe('Budget del mese')
    expect(titles).not.toContain('Spesa')
    expect(titles).toContain('Casa')
    await wrapper.findAll('.choice-list__row').find(row => row.text() === 'Casa')!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('budget-edit'))
    expect(router.currentRoute.value.params.categoria).toBe((await category(1)).id)
    expect(router.currentRoute.value.query.mese).toBe('2026-11')
    wrapper.unmount()
  })
})
