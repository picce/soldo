import type { Category, CategoryKind } from '@/db/schema'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { dismissToast, runToastAction, useToast } from '@/app/toast'
import { db } from '@/db/database'
import { categoryName } from '@/db/names'
import { getDefaultAccount } from '@/db/repositories/accounts'
import { getCategory, listCategories } from '@/db/repositories/categories'
import { addTransaction } from '@/db/repositories/transactions'
import { seedDefaults } from '@/db/seed'
import { testPlugins } from '@/test/plugins'
import CategoryEditView from './CategoryEditView.vue'

let expense: Category[]

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
  expense = await listCategories({ kind: 'expense' })
})

afterEach(() => dismissToast())

async function mountEditor(id: string | null, kind: CategoryKind = 'expense') {
  const router = createAppRouter(createMemoryHistory())
  await router.push('/impostazioni/categorie')
  await router.push(id
    ? `/impostazioni/categorie/${id}`
    : '/impostazioni/categorie/nuova')
  const wrapper = mount(CategoryEditView, {
    props: { id, kind },
    global: {
      plugins: testPlugins(router),
    },
  })
  await vi.waitFor(() => expect(wrapper.find('input[type="text"]').exists()).toBe(true))
  await flushPromises()
  return { wrapper, router }
}

function button(wrapper: Awaited<ReturnType<typeof mountEditor>>['wrapper'], label: string) {
  const found = wrapper.findAll('button').find(item => item.text() === label || item.attributes('aria-label') === label)
  if (!found)
    throw new Error(`No button ${label}`)
  return found
}

function toastMessage() {
  return useToast().toast.value?.message
}

describe('categoryEditView', () => {
  it('creates a category with the chosen icon and color, at the end of the grid', async () => {
    const { wrapper } = await mountEditor(null)
    expect(wrapper.get('h1').text()).toBe('Nuova categoria')
    // A new category starts from an icon and a color the others do not use yet.
    expect((wrapper.get('input[type="radio"][value="shopping-bag"]').element as HTMLInputElement).checked).toBe(true)

    await wrapper.get('input[type="text"]').setValue('Palestra')
    await wrapper.get('input[aria-label="Bilanciere"]').setValue(true)
    await wrapper.get('input[aria-label="Verde"]').setValue(true)
    expect(wrapper.text()).toContain('Verde')
    await button(wrapper, 'Salva').trigger('click')

    await vi.waitFor(async () => {
      const last = (await listCategories({ kind: 'expense' })).at(-1)!
      expect(last).toMatchObject({ name: 'Palestra', icon: 'barbell', color: 6 })
    })
    await vi.waitFor(() => expect(toastMessage()).toBe('Aggiunta: Palestra'))
  })

  it('asks for a name, and refuses one already in use', async () => {
    const { wrapper } = await mountEditor(null)
    await button(wrapper, 'Salva').trigger('click')
    expect(wrapper.text()).toContain('Scrivi un nome.')
    expect(wrapper.get('input[type="text"]').attributes('aria-invalid')).toBe('true')

    await wrapper.get('input[type="text"]').setValue('  spésa ')
    expect(wrapper.text()).toContain('C\'è già una categoria con questo nome.')
    await button(wrapper, 'Salva').trigger('click')
    await flushPromises()
    expect(await listCategories({ kind: 'expense' })).toHaveLength(12)
  })

  it('explains the default name and detaches it once changed', async () => {
    const groceries = expense[0]!
    const { wrapper } = await mountEditor(groceries.id)
    expect(wrapper.get('h1').text()).toBe('Spesa')
    expect(wrapper.text()).toContain('Nome predefinito: cambia con la lingua finché non lo modifichi.')

    await wrapper.get('input[type="text"]').setValue('Alimentari')
    expect(wrapper.text()).not.toContain('Nome predefinito')
    await button(wrapper, 'Salva').trigger('click')
    await vi.waitFor(async () => expect((await getCategory(groceries.id))!.name).toBe('Alimentari'))
  })

  it('deletes a category nobody uses, with Annulla', async () => {
    const pets = expense.find(category => category.preset === 'pets')!
    const { wrapper } = await mountEditor(pets.id)
    await button(wrapper, 'Elimina categoria').trigger('click')
    await vi.waitFor(async () => expect(await getCategory(pets.id)).toBeUndefined())
    await vi.waitFor(() => expect(toastMessage()).toBe('Eliminata: Animali'))

    await runToastAction()
    await vi.waitFor(async () => expect(await getCategory(pets.id)).toBeDefined())
  })

  it('offers only Archivia for a category in use, and Annulla brings it back', async () => {
    const groceries = expense[0]!
    const account = await getDefaultAccount()
    await addTransaction({
      kind: 'expense',
      amountCents: 1240,
      date: '2026-11-05',
      accountId: account!.id,
      categoryId: groceries.id,
      note: '',
    })
    const { wrapper } = await mountEditor(groceries.id)

    expect(wrapper.findAll('button').some(item => item.attributes('aria-label') === 'Elimina categoria')).toBe(false)
    expect(wrapper.text()).toContain('Usata in 1 movimento')
    await button(wrapper, 'Archivia').trigger('click')
    await vi.waitFor(async () => expect((await getCategory(groceries.id))!.archived).toBe(true))
    await vi.waitFor(() => expect(toastMessage()).toBe('Archiviata: Spesa'))

    await runToastAction()
    await vi.waitFor(async () => expect((await listCategories({ kind: 'expense' })).map(categoryName)[0]).toBe('Spesa'))
  })
})
