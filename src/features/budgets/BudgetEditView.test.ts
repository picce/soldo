import type { VueWrapper } from '@vue/test-utils'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { dismissToast, runToastAction, useToast } from '@/app/toast'
import { db } from '@/db/database'
import { getBudgetInForce, listBudgets, setBudget } from '@/db/repositories/budgets'
import { listCategories } from '@/db/repositories/categories'
import { seedDefaults } from '@/db/seed'
import { testPlugins } from '@/test/plugins'
import BudgetEditView from './BudgetEditView.vue'

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
})

afterEach(() => dismissToast())

async function mountEditor(categoryKey: string, month = '2026-03') {
  const router = createAppRouter(createMemoryHistory())
  await router.push(`/budget?mese=${month}`)
  await router.push(`/budget/${categoryKey}?mese=${month}`)
  const wrapper = mount(BudgetEditView, {
    props: { categoryKey, month },
    global: {
      plugins: testPlugins(router),
    },
  })
  await vi.waitFor(() => expect(wrapper.find('input').exists()).toBe(true))
  await flushPromises()
  return { wrapper, router }
}

function button(wrapper: VueWrapper, label: string) {
  return wrapper.findAll('button').find(item => item.text() === label)
}

describe('budgetEditView', () => {
  it('sets the monthly budget from this month on', async () => {
    const { wrapper, router } = await mountEditor('totale')
    expect(wrapper.get('h1').text()).toBe('Budget del mese')
    expect(wrapper.text()).toContain('Da marzo 2026 in poi')
    await wrapper.get('input').setValue('1.000')
    await button(wrapper, 'Salva')!.trigger('click')
    await vi.waitFor(async () => expect(await listBudgets()).toHaveLength(1))
    expect((await listBudgets())[0]).toMatchObject({
      month: '2026-03',
      categoryId: null,
      amountCents: 100000,
      repeat: true,
    })
    await vi.waitFor(() => expect(router.currentRoute.value.query.mese).toBe('2026-03'))
  })

  it('sets a budget for this month only', async () => {
    const [groceries] = await listCategories({ kind: 'expense' })
    const { wrapper } = await mountEditor(groceries!.id)
    expect(wrapper.get('h1').text()).toBe('Budget: Spesa')
    await wrapper.get('input').setValue('300')
    await button(wrapper, 'Solo marzo')!.trigger('click')
    expect(wrapper.text()).toContain('Solo per marzo 2026.')
    await button(wrapper, 'Salva')!.trigger('click')
    await vi.waitFor(async () => expect(await getBudgetInForce('2026-03', groceries!.id)).toBeDefined())
    expect(await getBudgetInForce('2026-04', groceries!.id)).toBeUndefined()
  })

  it('asks for an amount', async () => {
    const { wrapper } = await mountEditor('totale')
    await button(wrapper, 'Salva')!.trigger('click')
    expect(wrapper.text()).toContain('Scrivi un importo')
    await wrapper.get('input').setValue('0')
    await button(wrapper, 'Salva')!.trigger('click')
    await flushPromises()
    expect(await listBudgets()).toHaveLength(0)
  })

  it('shows a budget repeated from an earlier month, and takes it away from here with «Annulla»', async () => {
    await setBudget({
      month: '2026-01',
      categoryId: null,
      amountCents: 100000,
      repeat: true,
    })
    const { wrapper } = await mountEditor('totale')
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('1.000,00')
    // happy-dom has no ARIA reflection, so VvButton's pressed state shows as its class.
    expect(button(wrapper, 'Ogni mese')!.classes()).toContain('pressed')

    await button(wrapper, 'Togli')!.trigger('click')
    await vi.waitFor(async () => expect(await getBudgetInForce('2026-03', null)).toBeUndefined())
    expect(await getBudgetInForce('2026-02', null)).toBeDefined()
    expect(useToast().toast.value?.message).toBe('Budget del mese tolto da marzo.')

    await runToastAction()
    await vi.waitFor(async () => expect(await getBudgetInForce('2026-05', null)).toBeDefined())
  })

  it('has no «Togli» without a budget', async () => {
    const { wrapper } = await mountEditor('totale')
    expect(button(wrapper, 'Togli')).toBeUndefined()
  })
})
