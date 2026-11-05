import type { VueWrapper } from '@vue/test-utils'
import type { Category } from '@/db/schema'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { db } from '@/db/database'
import { getDefaultAccount } from '@/db/repositories/accounts'
import { listCategories } from '@/db/repositories/categories'
import { addTransaction } from '@/db/repositories/transactions'
import { seedDefaults } from '@/db/seed'
import { today } from '@/domain/dates'
import { shiftPeriod } from '@/domain/periods'
import { testPlugins } from '@/test/plugins'
import HomeView from './HomeView.vue'

let expense: Category[]
let income: Category[]

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
  expense = await listCategories({ kind: 'expense' })
  income = await listCategories({ kind: 'income' })
})

async function add(kind: 'expense' | 'income', amountCents: number, category: Category, date = today()) {
  const account = await getDefaultAccount()
  await addTransaction({
    kind,
    amountCents,
    date,
    accountId: account!.id,
    categoryId: category.id,
    note: '',
  })
}

async function mountHome() {
  const router = createAppRouter(createMemoryHistory())
  await router.push('/')
  const wrapper = mount(HomeView, {
    global: {
      plugins: testPlugins(createPinia(), router),
    },
  })
  await vi.waitFor(() => expect(wrapper.find('.summary-card').exists()).toBe(true))
  return wrapper
}

/** Label and amount of each line of the statement, with plain spaces (Intl puts a no-break space before €). */
function summaryLines(wrapper: VueWrapper) {
  return wrapper.findAll('.summary-card__line').map(line => [
    line.get('dt').text(),
    line.get('dd').text().replace(/\s/g, ' '),
  ])
}

describe('homeView', () => {
  it('shows the statement and the expenses per category of the month', async () => {
    await add('income', 245000, income[0]!)
    await add('expense', 41280, expense[0]!)
    await add('expense', 35000, expense[1]!)
    await add('expense', 9500, expense[0]!)
    // Last month does not count.
    await add('expense', 100, expense[2]!, shiftPeriod({
      unit: 'month',
      anchor: today(),
    }, -1).anchor)

    const wrapper = await mountHome()
    await vi.waitFor(() => expect(wrapper.findAll('.category-rows li')).toHaveLength(2))

    expect(summaryLines(wrapper)).toEqual([
      ['Entrate', '2.450,00'],
      ['Uscite', '−857,80'],
      ['Saldo', '+1.592,20 €'],
    ])

    const rows = wrapper.findAll('.category-rows li').map(row => [
      row.get('.category-rows__name').text(),
      row.get('.amount-text').text(),
      row.get('.category-rows__percent').text(),
    ])
    expect(rows).toEqual([
      ['Spesa', '507,80', '59%'],
      ['Casa', '350,00', '41%'],
    ])
    expect(wrapper.get('.category-bar').attributes('aria-label')).toBe('Uscite per categoria: Spesa 59%, Casa 41%')

    const link = wrapper.get('.category-rows a').attributes('href')
    expect(link).toContain(`categoria=${expense[0]!.id}`)
    expect(link).toContain('dal=')
  })

  it('shows the empty state', async () => {
    const wrapper = await mountHome()
    expect(wrapper.find('.category-bar--empty').exists()).toBe(true)
    expect(wrapper.get('.home__empty').text()).toMatch(/^Nessun movimento a \S+\./)
    expect(summaryLines(wrapper).at(-1)).toEqual(['Saldo', '0,00 €'])
  })

  it('moves to the previous period with the arrow', async () => {
    await add('expense', 1240, expense[0]!)
    const wrapper = await mountHome()
    await vi.waitFor(() => expect(wrapper.findAll('.category-rows li')).toHaveLength(1))

    await wrapper.get('button[aria-label="Periodo precedente"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.home__empty').exists()).toBe(true))
  })

  it('links the buttons to a new expense and a new income', async () => {
    const wrapper = await mountHome()
    const links = wrapper.findAll('.action-bar a').map(link => [
      link.text(),
      link.attributes('href'),
    ])
    expect(links).toEqual([
      ['Uscita', '/nuovo/uscita'],
      ['Entrata', '/nuovo/entrata'],
    ])
  })
})
