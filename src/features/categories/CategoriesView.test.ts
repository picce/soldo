import type { VueWrapper } from '@vue/test-utils'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { db } from '@/db/database'
import { categoryName } from '@/db/names'
import { archiveCategory, listCategories } from '@/db/repositories/categories'
import { seedDefaults } from '@/db/seed'
import { testPlugins } from '@/test/plugins'
import CategoriesView from './CategoriesView.vue'

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
})

async function mountCategories(path = '/impostazioni/categorie') {
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  const wrapper = mount(CategoriesView, {
    global: {
      plugins: testPlugins(router),
    },
    attachTo: document.body,
  })
  await vi.waitFor(() => expect(wrapper.findAll('.categories__list > li').length).toBeGreaterThan(0))
  return { wrapper, router }
}

function rowNames(wrapper: VueWrapper) {
  return wrapper.findAll('.categories__list:not(.categories__list--archived) .category-link__name').map(name => name.text())
}

async function savedNames(kind: 'expense' | 'income' = 'expense') {
  return (await listCategories({ kind })).map(categoryName)
}

describe('categoriesView', () => {
  it('lists the expense categories in the order of the quick add', async () => {
    const { wrapper } = await mountCategories()
    expect(rowNames(wrapper).slice(0, 3)).toEqual(['Spesa', 'Casa', 'Ristoranti'])
    expect(wrapper.get('a[href$="/nuova"]').text()).toBe('Nuova categoria')
    wrapper.unmount()
  })

  it('switches to income with the kind in the URL', async () => {
    const { wrapper, router } = await mountCategories('/impostazioni/categorie?tipo=entrate')
    await vi.waitFor(() => expect(rowNames(wrapper)).toEqual([
      'Stipendio',
      'Rimborsi',
      'Regali ricevuti',
      'Altre entrate',
    ]))
    expect(wrapper.find('a[href$="/nuova?tipo=entrate"]').exists()).toBe(true)

    await wrapper.findAll('.segmented-control button').find(button => button.text() === 'Uscite')!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.tipo).toBeUndefined())
    wrapper.unmount()
  })

  it('moves a row with the buttons, saves the order and keeps the focus', async () => {
    const { wrapper } = await mountCategories()
    const down = wrapper.get('button[aria-label="Sposta giù: Spesa"]')
    await down.trigger('click')
    await flushPromises()

    expect(rowNames(wrapper).slice(0, 2)).toEqual(['Casa', 'Spesa'])
    await vi.waitFor(async () => expect((await savedNames()).slice(0, 2)).toEqual(['Casa', 'Spesa']))
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Sposta giù: Spesa')
    expect(wrapper.get('[aria-live="polite"]').text()).toBe('Spesa: posizione 2 di 12')

    await wrapper.get('button[aria-label="Sposta su: Spesa"]').trigger('click')
    await vi.waitFor(async () => expect((await savedNames()).slice(0, 2)).toEqual(['Spesa', 'Casa']))
    wrapper.unmount()
  })

  it('does nothing past the ends of the list', async () => {
    const { wrapper } = await mountCategories()
    const up = wrapper.get('button[aria-label="Sposta su: Spesa"]')
    expect(up.attributes('aria-disabled')).toBe('true')
    await up.trigger('click')
    await flushPromises()
    expect(rowNames(wrapper)[0]).toBe('Spesa')
    expect(wrapper.get('[aria-live="polite"]').text()).toBe('')
    wrapper.unmount()
  })

  it('keeps archived categories in a closed section', async () => {
    const [groceries] = await listCategories({ kind: 'expense' })
    await archiveCategory(groceries!.id)
    const { wrapper } = await mountCategories()
    await vi.waitFor(() => expect(wrapper.find('details').exists()).toBe(true))
    expect(rowNames(wrapper)).not.toContain('Spesa')
    expect(wrapper.get('details summary').text()).toBe('Archiviate (1)')
    expect(wrapper.get('details').attributes('open')).toBeUndefined()
    expect(wrapper.get('.categories__list--archived').text()).toContain('Spesa')
    wrapper.unmount()
  })
})
