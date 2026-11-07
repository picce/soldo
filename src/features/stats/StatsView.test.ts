import type { VueWrapper } from '@vue/test-utils'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { db } from '@/db/database'
import { getDefaultAccount } from '@/db/repositories/accounts'
import { listCategories } from '@/db/repositories/categories'
import { addTransaction } from '@/db/repositories/transactions'
import { seedDefaults } from '@/db/seed'
import { testPlugins } from '@/test/plugins'
import CategoryTrendView from './CategoryTrendView.vue'
import StatsView from './StatsView.vue'

/** Statistics on Saturday 7 November 2026. */
beforeEach(async () => {
  vi.useFakeTimers({
    toFake: ['Date'],
  })
  vi.setSystemTime(new Date(2026, 10, 7, 10))
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
})

afterEach(() => vi.useRealTimers())

async function add(kind: 'expense' | 'income', date: string, amountCents: number, preset: string) {
  const category = (await listCategories()).find(item => item.preset === preset)!
  await addTransaction({
    kind,
    amountCents,
    date,
    accountId: (await getDefaultAccount())!.id,
    categoryId: category.id,
    note: '',
  })
  return category
}

async function seed() {
  await add('expense', '2026-10-02', 5000, 'groceries')
  await add('expense', '2026-10-06', 3000, 'groceries')
  await add('expense', '2026-10-20', 9000, 'groceries')
  await add('expense', '2026-11-03', 9000, 'groceries')
  await add('expense', '2026-11-05', 4000, 'restaurants')
  await add('income', '2026-11-01', 185000, 'salary')
  await add('expense', '2026-06-10', 12000, 'groceries')
}

async function mountStats(path = '/statistiche') {
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  const wrapper = mount(StatsView, {
    global: {
      plugins: testPlugins(router),
    },
    attachTo: document.body,
  })
  await vi.waitFor(() => expect(wrapper.find('.stats-card, .stats__empty').exists()).toBe(true))
  await flushPromises()
  return { wrapper, router }
}

/** The words of an element, a space between the pieces even where the markup has none. */
function words(element: Element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const pieces: string[] = []
  while (walker.nextNode())
    pieces.push(walker.currentNode.textContent!.trim())
  return pieces.filter(Boolean).join(' ').replace(/\s+/g, ' ')
}

function text(wrapper: VueWrapper, selector: string) {
  return words(wrapper.get(selector).element)
}

describe('statsView', () => {
  it('explains what is coming when there is nothing yet', async () => {
    const { wrapper } = await mountStats()
    expect(wrapper.text()).toContain('Ancora niente da confrontare')
    expect(wrapper.get('.stats__empty a').attributes('href')).toBe('/nuovo/uscita')
    wrapper.unmount()
  })

  it('compares the month so far with the same days of the month before', async () => {
    await seed()
    const { wrapper } = await mountStats()
    expect(wrapper.get('h2.type-title').text()).toBe('Novembre 2026')
    const card = text(wrapper, '.stats-card')
    expect(card).toContain('130,00 €')
    expect(card).toContain('63% · +50,00 € rispetto a 1–7 ottobre')
    expect(card).toContain('Entrate 1.850,00')
    expect(card).toContain('Risparmiato 1.720,00')
    expect(card).toContain('Al giorno 18,57')

    // The categories come from their own query, maybe a moment after the figures: two expenses, one income.
    await vi.waitFor(() => expect(wrapper.findAll('.stats-categories__row')).toHaveLength(3))
    const rows = wrapper.findAll('.stats-categories__row').map(row => words(row.element))
    expect(rows[0]).toContain('Spesa')
    expect(rows[0]).toContain('13% · +10,00 €')
    expect(rows[1]).toContain('Ristoranti')
    expect(rows[1]).toContain('nuova')
    expect(wrapper.findAll('.stats-categories__row')[0]!.attributes('href')).toMatch(/^\/statistiche\/categoria\/.+\?mese=2026-11$/)
    wrapper.unmount()
  })

  it('reads a day of the chart with the keyboard', async () => {
    await seed()
    const { wrapper } = await mountStats()
    const chart = wrapper.get('[role="group"][aria-label="Uscite accumulate giorno per giorno"]')
    await chart.trigger('keydown', { key: 'ArrowLeft' })
    await chart.trigger('keydown', { key: 'ArrowLeft' })
    expect(text(wrapper, '.stats-chart__readout')).toBe('6 nov 130,00 € · ott 80,00 €')
    wrapper.unmount()
  })

  it('compares a past month whole', async () => {
    await seed()
    const { wrapper } = await mountStats('/statistiche?mese=2026-10')
    expect(text(wrapper, '.stats-card')).toContain('170,00 €')
    expect(text(wrapper, '.stats-card')).toContain('rispetto a settembre')
    wrapper.unmount()
  })

  it('shows the year month by month, and opens a month from the chart', async () => {
    await seed()
    const { wrapper, router } = await mountStats('/statistiche?anno=2026')
    expect(wrapper.get('h2.type-title').text()).toBe('2026')
    expect(text(wrapper, '.stats-card')).toContain('rispetto al 2025, fino al 7 nov')
    const chart = wrapper.get('[role="group"][aria-label="Entrate e uscite mese per mese"]')
    expect(chart.findAll('tbody tr')).toHaveLength(12)
    await chart.trigger('keydown', { key: 'Home' })
    for (let step = 0; step < 9; step++)
      await chart.trigger('keydown', { key: 'ArrowRight' })
    expect(text(wrapper, '.stats-chart__readout')).toBe('Ottobre 0,00 · −170,00')
    await wrapper.get('.stats__link').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ mese: '2026-10' }))
    wrapper.unmount()
  })

  it('moves between a month and its year with the tabs', async () => {
    await seed()
    const { wrapper, router } = await mountStats('/statistiche?mese=2025-06')
    await wrapper.get('#period-tab-year').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ anno: '2025' }))
    await vi.waitFor(() => expect(wrapper.get('h2.type-title').text()).toBe('2025'))
    await wrapper.get('#period-tab-month').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ mese: '2025-12' }))
    expect(wrapper.findAll('[role="tab"]').map(tab => tab.text())).toEqual(['Mese', 'Anno'])
    wrapper.unmount()
  })
})

describe('categoryTrendView', () => {
  async function mountTrend(categoryId: string, month: string) {
    const router = createAppRouter(createMemoryHistory())
    await router.push(`/statistiche/categoria/${categoryId}?mese=${month}`)
    const wrapper = mount(CategoryTrendView, {
      props: { categoryId, month },
      global: {
        plugins: testPlugins(router),
      },
    })
    await vi.waitFor(() => expect(wrapper.find('.trend-card').exists()).toBe(true))
    await flushPromises()
    return wrapper
  }

  it('shows a month against the average of the finished ones, and leads to its transactions', async () => {
    await seed()
    const groceries = (await listCategories()).find(item => item.preset === 'groceries')!
    const wrapper = await mountTrend(groceries.id, '2026-10')
    await vi.waitFor(() => expect(wrapper.get('h1').text()).toBe('Spesa'))
    const card = text(wrapper, '.trend-card')
    expect(card).toContain('Ottobre 2026')
    expect(card).toContain('170,00 €')
    // From June 2026, its first month, to October 2026: 290 € over 5 months of the 12.
    expect(card).toContain('Media al mese 58,00')
    expect(card).toContain('+112,00 € sulla media')
    expect(wrapper.findAll('.trend-months__row')).toHaveLength(12)
    expect(wrapper.get('.trend__transactions').attributes('href')).toBe(`/movimenti?categoria=${groceries.id}&dal=2026-10-01&al=2026-10-31`)
  })

  it('does not compare the month still running', async () => {
    await seed()
    const groceries = (await listCategories()).find(item => item.preset === 'groceries')!
    const wrapper = await mountTrend(groceries.id, '2026-11')
    expect(text(wrapper, '.trend-card')).toContain('90,00 € finora')
    expect(wrapper.text()).not.toContain('sulla media')
  })
})
