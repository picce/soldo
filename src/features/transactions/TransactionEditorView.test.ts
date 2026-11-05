import type { VueWrapper } from '@vue/test-utils'
import type { EditorTarget } from './useTransactionEditor'
import type { Category } from '@/db/schema'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { dismissToast, runToastAction, useToast } from '@/app/toast'
import { db } from '@/db/database'
import { getDefaultAccount } from '@/db/repositories/accounts'
import { listCategories } from '@/db/repositories/categories'
import { addTransaction, getTransaction, listTransactions } from '@/db/repositories/transactions'
import { seedDefaults } from '@/db/seed'
import { today } from '@/domain/dates'
import { testPlugins } from '@/test/plugins'
import TransactionEditorView from './TransactionEditorView.vue'

const { toast } = useToast()

/** Intl puts a no-break space before €: compare texts with plain spaces. */
function toastMessage() {
  return toast.value?.message.replace(/\s/g, ' ')
}

let expenseCategories: Category[]

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
  expenseCategories = await listCategories({ kind: 'expense' })
})

afterEach(() => dismissToast())

async function mountEditor(target: EditorTarget, categoryCount = 12) {
  const router = createAppRouter(createMemoryHistory())
  await router.push('/')
  const wrapper = mount(TransactionEditorView, {
    props: { target },
    global: {
      plugins: testPlugins(router),
    },
    attachTo: document.body,
  })
  // Categories (and the transaction, when editing) come from IndexedDB.
  await vi.waitFor(() => expect(wrapper.findAll('.category-grid__item')).toHaveLength(categoryCount))
  return { wrapper, router }
}

async function press(wrapper: VueWrapper, keys: string[]) {
  for (const key of keys) {
    const button = wrapper.findAll('.keypad__key')
      .find(item => item.attributes('aria-label') === key || item.text() === key)
    await button!.trigger('click')
  }
}

async function tapCategory(wrapper: VueWrapper, name: string) {
  const item = wrapper.findAll('.category-grid__item').find(button => button.text() === name)
  await item!.trigger('click')
  await flushPromises()
}

function amountText(wrapper: VueWrapper) {
  return wrapper.get('.editor__value').text().replace(/\s+/g, ' ')
}

describe('new transaction', () => {
  it('saves with a tap on the category and goes back', async () => {
    const { wrapper, router } = await mountEditor({ mode: 'new', kind: 'expense' })
    await press(wrapper, [
      '8',
      'Virgola',
      '9',
      'Più',
      '3',
      'Virgola',
      '5',
    ])
    expect(wrapper.get('.editor__line').text()).toBe('8,9 + 3,5')
    expect(amountText(wrapper)).toBe('−12,40 €')

    await tapCategory(wrapper, 'Spesa')
    await vi.waitFor(async () => expect(await listTransactions()).toHaveLength(1))

    const [saved] = await listTransactions()
    const account = await getDefaultAccount()
    expect(saved).toMatchObject({
      kind: 'expense',
      amountCents: 1240,
      date: today(),
      categoryId: expenseCategories[0]!.id,
      accountId: account!.id,
      note: '',
      source: 'manual',
    })
    expect(toastMessage()).toBe('Salvato: −12,40 € · Spesa')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('home'))
  })

  it('asks for the amount first', async () => {
    const { wrapper } = await mountEditor({ mode: 'new', kind: 'expense' })
    await tapCategory(wrapper, 'Casa')
    expect(wrapper.get('[role="alert"]').text()).toBe('Scrivi prima l\'importo')
    expect(await listTransactions()).toHaveLength(0)

    // The hint goes away at the next key.
    await press(wrapper, ['5'])
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('refuses a result that is not positive', async () => {
    const { wrapper } = await mountEditor({ mode: 'new', kind: 'expense' })
    await press(wrapper, ['5', 'Meno', '8'])
    await tapCategory(wrapper, 'Casa')
    expect(wrapper.get('[role="alert"]').text()).toBe('Importo non valido')
    expect(await listTransactions()).toHaveLength(0)
  })

  it('switches to income and shows its categories', async () => {
    const { wrapper } = await mountEditor({ mode: 'new', kind: 'income' }, 4)
    expect(wrapper.get('.category-grid__item').text()).toBe('Stipendio')
    await press(wrapper, ['5', '0'])
    expect(amountText(wrapper)).toBe('+50 €')
  })
})

describe('existing transaction', () => {
  async function addExpense() {
    const account = await getDefaultAccount()
    return addTransaction({
      kind: 'expense',
      amountCents: 1240,
      date: '2026-11-04',
      accountId: account!.id,
      categoryId: expenseCategories[0]!.id,
      note: 'Esselunga',
    })
  }

  it('changes amount and category only with Salva', async () => {
    const original = await addExpense()
    const { wrapper } = await mountEditor({ mode: 'edit', id: original.id })
    expect(amountText(wrapper)).toBe('−12,40 €')
    expect(wrapper.get('.category-grid__item[aria-pressed="true"]').text()).toBe('Spesa')

    // The first digit replaces the saved amount.
    await press(wrapper, ['5'])
    await tapCategory(wrapper, 'Casa')
    expect((await getTransaction(original.id))?.amountCents).toBe(1240)

    await wrapper.findAll('button').find(button => button.text() === 'Salva')!.trigger('click')
    await vi.waitFor(async () => expect((await getTransaction(original.id))?.amountCents).toBe(500))
    expect(await getTransaction(original.id)).toMatchObject({
      categoryId: expenseCategories[1]!.id,
      date: '2026-11-04',
      note: 'Esselunga',
    })
    expect(toastMessage()).toBe('Salvato: −5,00 € · Casa')
  })

  it('deletes and restores with Annulla', async () => {
    const original = await addExpense()
    const { wrapper } = await mountEditor({ mode: 'edit', id: original.id })
    await wrapper.get('button[aria-label="Elimina movimento"]').trigger('click')
    await vi.waitFor(() => expect(toastMessage()).toBe('Eliminato: −12,40 € · Spesa'))
    expect(await getTransaction(original.id)).toBeUndefined()
    expect(toast.value?.action?.label).toBe('Annulla')

    await runToastAction()
    expect(await getTransaction(original.id)).toBeDefined()
  })

  it('duplicates with today\'s date, and Annulla removes the copy', async () => {
    const original = await addExpense()
    const { wrapper } = await mountEditor({ mode: 'edit', id: original.id })
    await wrapper.findAll('button').find(button => button.text() === 'Duplica')!.trigger('click')
    await vi.waitFor(async () => expect(await listTransactions()).toHaveLength(2))

    const copy = (await listTransactions()).find(item => item.id !== original.id)
    expect(copy).toMatchObject({
      amountCents: 1240,
      date: today(),
      note: 'Esselunga',
    })
    expect(toastMessage()).toBe('Duplicato: −12,40 € · Spesa')

    await runToastAction()
    expect(await listTransactions()).toHaveLength(1)
  })

  it('leaves when the transaction does not exist', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/')
    mount(TransactionEditorView, {
      props: {
        target: { mode: 'edit', id: 'missing' },
      },
      global: {
        plugins: testPlugins(router),
      },
    })
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('transactions'))
  })
})
