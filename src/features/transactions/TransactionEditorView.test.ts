import type { VueWrapper } from '@vue/test-utils'
import type { EditorTarget } from './useTransactionEditor'
import type { Category } from '@/db/schema'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { dismissToast, runToastAction, useToast } from '@/app/toast'
import { db } from '@/db/database'
import { archiveAccount, createAccount, getDefaultAccount } from '@/db/repositories/accounts'
import { setBudget } from '@/db/repositories/budgets'
import { listCategories } from '@/db/repositories/categories'
import { archivePaymentMethod, listPaymentMethods, updatePaymentMethod } from '@/db/repositories/payment-methods'
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

  it('saves the note written in the screen, with the other buttons out of the way meanwhile', async () => {
    const { wrapper } = await mountEditor({ mode: 'new', kind: 'expense' })
    await press(wrapper, ['7'])
    await wrapper.get('.note-field .action-chip').trigger('click')
    expect(wrapper.get('.editor__chips').classes()).toContain('editor__chips--note')
    await wrapper.get('.note-field__input').setValue('Pane e latte')

    // No «Fatto»: the category saves what is written.
    await tapCategory(wrapper, 'Spesa')
    await vi.waitFor(async () => expect(await listTransactions()).toHaveLength(1))
    expect((await listTransactions())[0]).toMatchObject({ amountCents: 700, note: 'Pane e latte' })
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

function chip(wrapper: VueWrapper, text: string) {
  return wrapper.findAll('.action-chip').find(item => item.text() === text)
}

/** Picks a row in the sheets of the screen: the first that names it. */
async function choose(wrapper: VueWrapper, title: string) {
  await wrapper.findAll('.choice-list__row').find(button => button.text().includes(title))!.trigger('click')
  await flushPromises()
}

async function byPreset(preset: string) {
  return (await listPaymentMethods()).find(method => method.preset === preset)!
}

describe('payment method', () => {
  it('starts from the first of the list, and saves without an extra tap', async () => {
    const { wrapper } = await mountEditor({ mode: 'new', kind: 'expense' })
    await vi.waitFor(() => expect(chip(wrapper, 'Contanti')).toBeDefined())
    await press(wrapper, ['5'])
    await tapCategory(wrapper, 'Spesa')
    await vi.waitFor(async () => expect(await listTransactions()).toHaveLength(1))
    expect((await listTransactions())[0]).toMatchObject({
      accountId: (await getDefaultAccount())!.id,
      paymentMethodId: (await byPreset('cash')).id,
    })
  })

  it('takes the account from the method', async () => {
    const bank = await createAccount({
      name: 'Banca',
      icon: 'bank',
      color: 7,
      initialBalanceCents: 0,
    })
    const card = await byPreset('card')
    await updatePaymentMethod(card.id, { accountId: bank.id })

    const { wrapper } = await mountEditor({ mode: 'new', kind: 'expense' })
    await vi.waitFor(() => expect(chip(wrapper, 'Contanti')).toBeDefined())
    await chip(wrapper, 'Contanti')!.trigger('click')
    await flushPromises()
    await choose(wrapper, 'Carta')
    expect(chip(wrapper, 'Carta')).toBeDefined()
    await press(wrapper, ['5'])
    await tapCategory(wrapper, 'Spesa')
    await vi.waitFor(async () => expect(await listTransactions()).toHaveLength(1))
    expect((await listTransactions())[0]).toMatchObject({ accountId: bank.id, paymentMethodId: card.id })
  })

  it('starts the next expense from the last one used', async () => {
    const satispay = await byPreset('satispay')
    await addTransaction({
      kind: 'expense',
      amountCents: 100,
      date: today(),
      accountId: satispay.accountId,
      categoryId: expenseCategories[0]!.id,
      note: '',
      paymentMethodId: satispay.id,
    })
    const { wrapper } = await mountEditor({ mode: 'new', kind: 'expense' })
    await vi.waitFor(() => expect(chip(wrapper, 'Satispay')).toBeDefined())
  })

  it('is not on an income, which asks for the account only with two of them', async () => {
    const { wrapper } = await mountEditor({ mode: 'new', kind: 'income' }, 4)
    await flushPromises()
    expect(wrapper.findAll('.action-chip').map(item => item.text())).toEqual(['Oggi', 'Nota'])
    wrapper.unmount()

    await createAccount({
      name: 'Banca',
      icon: 'bank',
      color: 7,
      initialBalanceCents: 0,
    })
    const two = await mountEditor({ mode: 'new', kind: 'income' }, 4)
    await vi.waitFor(() => expect(chip(two.wrapper, 'Contanti')).toBeDefined())
    await chip(two.wrapper, 'Contanti')!.trigger('click')
    await flushPromises()
    await choose(two.wrapper, 'Banca')
    await press(two.wrapper, ['5'])
    await tapCategory(two.wrapper, 'Stipendio')
    await vi.waitFor(async () => expect(await listTransactions()).toHaveLength(1))
    const [saved] = await listTransactions()
    expect(saved?.paymentMethodId).toBeUndefined()
    expect(saved?.accountId).not.toBe((await getDefaultAccount())!.id)
  })

  it('drops the method when an expense becomes an income, and the account stays', async () => {
    const card = await byPreset('card')
    const account = (await getDefaultAccount())!
    const saved = await addTransaction({
      kind: 'expense',
      amountCents: 100,
      date: today(),
      accountId: account.id,
      categoryId: expenseCategories[0]!.id,
      note: '',
      paymentMethodId: card.id,
    })
    const { wrapper } = await mountEditor({ mode: 'edit', id: saved.id })
    await vi.waitFor(() => expect(chip(wrapper, 'Carta')).toBeDefined())
    await wrapper.findAll('.segmented-control__segment').find(item => item.text() === 'Entrata')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('.category-grid__item')).toHaveLength(4))
    await tapCategory(wrapper, 'Stipendio')
    await wrapper.findAll('.editor__action').find(item => item.text() === 'Salva')!.trigger('click')
    await vi.waitFor(async () => expect((await getTransaction(saved.id))?.kind).toBe('income'))
    const stored = await getTransaction(saved.id)
    expect(stored?.paymentMethodId).toBeUndefined()
    expect(stored?.accountId).toBe(account.id)
  })

  it('keeps an old expense on its account and without a method until one is chosen', async () => {
    const account = (await getDefaultAccount())!
    const bank = await createAccount({
      name: 'Banca',
      icon: 'bank',
      color: 7,
      initialBalanceCents: 0,
    })
    const card = await byPreset('card')
    await updatePaymentMethod(card.id, { accountId: bank.id })
    const saved = await addTransaction({
      kind: 'expense',
      amountCents: 100,
      date: today(),
      accountId: account.id,
      categoryId: expenseCategories[0]!.id,
      note: '',
    })

    const { wrapper } = await mountEditor({ mode: 'edit', id: saved.id })
    await vi.waitFor(() => expect(chip(wrapper, 'Pagamento')).toBeDefined())
    await wrapper.findAll('.editor__action').find(item => item.text() === 'Salva')!.trigger('click')
    await vi.waitFor(() => expect(useToast().toast.value).toBeTruthy())
    expect(await getTransaction(saved.id)).toMatchObject({ accountId: account.id })
    expect((await getTransaction(saved.id))?.paymentMethodId).toBeUndefined()
  })

  it('leaves an expense on its account when its method moved to another one', async () => {
    const account = (await getDefaultAccount())!
    const bank = await createAccount({
      name: 'Banca',
      icon: 'bank',
      color: 7,
      initialBalanceCents: 0,
    })
    const card = await byPreset('card')
    const saved = await addTransaction({
      kind: 'expense',
      amountCents: 100,
      date: today(),
      accountId: account.id,
      categoryId: expenseCategories[0]!.id,
      note: '',
      paymentMethodId: card.id,
    })
    await updatePaymentMethod(card.id, { accountId: bank.id })

    const { wrapper } = await mountEditor({ mode: 'edit', id: saved.id })
    await vi.waitFor(() => expect(chip(wrapper, 'Carta')).toBeDefined())
    await wrapper.findAll('.editor__action').find(item => item.text() === 'Salva')!.trigger('click')
    await vi.waitFor(() => expect(useToast().toast.value).toBeTruthy())
    expect((await getTransaction(saved.id))?.accountId).toBe(account.id)
  })

  it('offers an archived method only on the expense that already uses it', async () => {
    const card = await byPreset('card')
    const saved = await addTransaction({
      kind: 'expense',
      amountCents: 100,
      date: today(),
      accountId: card.accountId,
      categoryId: expenseCategories[0]!.id,
      note: '',
      paymentMethodId: card.id,
    })
    await archivePaymentMethod(card.id)
    const { wrapper } = await mountEditor({ mode: 'edit', id: saved.id })
    await vi.waitFor(() => expect(chip(wrapper, 'Carta')).toBeDefined())
    wrapper.unmount()

    const fresh = await mountEditor({ mode: 'new', kind: 'expense' })
    await vi.waitFor(() => expect(chip(fresh.wrapper, 'Contanti')).toBeDefined())
  })
})

describe('transfer', () => {
  it('is offered from the second active account on', async () => {
    const single = await mountEditor({ mode: 'new', kind: 'expense' })
    await flushPromises()
    expect(single.wrapper.findAll('.segmented-control__segment').map(item => item.text())).toEqual(['Uscita', 'Entrata'])
    single.wrapper.unmount()

    await createAccount({
      name: 'Banca',
      icon: 'bank',
      color: 7,
      initialBalanceCents: 0,
    })
    const { wrapper } = await mountEditor({ mode: 'new', kind: 'expense' })
    await vi.waitFor(() => expect(wrapper.findAll('.segmented-control__segment').map(item => item.text())).toEqual(['Uscita', 'Entrata', 'Trasferimento']))
  })

  async function mountTransfer() {
    const bank = await createAccount({
      name: 'Banca',
      icon: 'bank',
      color: 7,
      initialBalanceCents: 0,
    })
    const { wrapper, router } = await mountEditor({ mode: 'new', kind: 'expense' })
    await vi.waitFor(() => expect(wrapper.findAll('.segmented-control__segment')).toHaveLength(3))
    await wrapper.findAll('.segmented-control__segment').find(item => item.text() === 'Trasferimento')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('.editor__side')).toHaveLength(2))
    await vi.waitFor(() => expect(wrapper.findAll('.editor__side-name').map(item => item.text())).toEqual(['Contanti', 'Banca']))
    return { wrapper, router, bank }
  }

  it('saves between two accounts with Salva, with no category and no method', async () => {
    const { wrapper, router, bank } = await mountTransfer()
    const cash = (await getDefaultAccount())!
    await press(wrapper, ['5', '0'])
    expect(amountText(wrapper)).toBe('50 €')
    await wrapper.get('.editor__transfer-save').trigger('click')
    await vi.waitFor(async () => expect(await listTransactions()).toHaveLength(1))
    const [saved] = await listTransactions()
    expect(saved).toMatchObject({
      kind: 'transfer',
      amountCents: 5000,
      accountId: cash.id,
      toAccountId: bank.id,
      categoryId: null,
    })
    expect(saved?.paymentMethodId).toBeUndefined()
    expect(toastMessage()).toBe('Salvato: 50,00 € · Contanti → Banca')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('home'))
  })

  it('asks for the amount first', async () => {
    const { wrapper } = await mountTransfer()
    await wrapper.get('.editor__transfer-save').trigger('click')
    await flushPromises()
    expect(wrapper.get('.editor__line--hint').text()).toBe('Scrivi prima l\'importo')
    expect(await listTransactions()).toHaveLength(0)
  })

  it('swaps the two sides', async () => {
    const { wrapper } = await mountTransfer()
    await chip(wrapper, 'Scambia')!.trigger('click')
    expect(wrapper.findAll('.editor__side-name').map(item => item.text())).toEqual(['Banca', 'Contanti'])
  })

  it('edits and deletes a saved transfer, whose kind does not change', async () => {
    const cash = (await getDefaultAccount())!
    const bank = await createAccount({
      name: 'Banca',
      icon: 'bank',
      color: 7,
      initialBalanceCents: 0,
    })
    const saved = await addTransaction({
      kind: 'transfer',
      amountCents: 1000,
      date: today(),
      accountId: bank.id,
      toAccountId: cash.id,
      categoryId: null,
      note: '',
    })
    const router = createAppRouter(createMemoryHistory())
    await router.push('/')
    const wrapper = mount(TransactionEditorView, {
      props: {
        target: { mode: 'edit', id: saved.id },
      },
      global: {
        plugins: testPlugins(router),
      },
      attachTo: document.body,
    })
    await vi.waitFor(() => expect(wrapper.findAll('.editor__side-name').map(item => item.text())).toEqual(['Banca', 'Contanti']))
    expect(wrapper.findAll('.segmented-control__segment').map(item => item.text())).toEqual(['Trasferimento'])
    await chip(wrapper, 'Scambia')!.trigger('click')
    await wrapper.findAll('.editor__action').find(item => item.text() === 'Salva')!.trigger('click')
    await vi.waitFor(async () => expect((await getTransaction(saved.id))?.accountId).toBe(cash.id))
    expect((await getTransaction(saved.id))?.toAccountId).toBe(bank.id)
    wrapper.unmount()
  })

  it('keeps a transfer that uses an archived account editable', async () => {
    const cash = (await getDefaultAccount())!
    const bank = await createAccount({
      name: 'Banca',
      icon: 'bank',
      color: 7,
      initialBalanceCents: 0,
    })
    const saved = await addTransaction({
      kind: 'transfer',
      amountCents: 1000,
      date: today(),
      accountId: bank.id,
      toAccountId: cash.id,
      categoryId: null,
      note: '',
    })
    await archiveAccount(bank.id)
    const router = createAppRouter(createMemoryHistory())
    await router.push('/')
    const wrapper = mount(TransactionEditorView, {
      props: {
        target: { mode: 'edit', id: saved.id },
      },
      global: {
        plugins: testPlugins(router),
      },
      attachTo: document.body,
    })
    await vi.waitFor(() => expect(wrapper.findAll('.editor__side-name').map(item => item.text())).toEqual(['Banca', 'Contanti']))
    wrapper.unmount()
  })
})

describe('budget warning', () => {
  const month = today().slice(0, 7)

  async function spend(keys: string[], category = 'Spesa') {
    dismissToast()
    const { wrapper } = await mountEditor({ mode: 'new', kind: 'expense' })
    await press(wrapper, keys)
    await tapCategory(wrapper, category)
    await vi.waitFor(() => expect(toastMessage()).toMatch(/^Salvato/))
    wrapper.unmount()
    return toastMessage()
  }

  it('adds to the notice when an expense takes the category past 80%', async () => {
    await setBudget({
      month,
      categoryId: expenseCategories[0]!.id,
      amountCents: 1000,
      repeat: true,
    })
    expect(await spend(['5'])).toBe('Salvato: −5,00 € · Spesa')
    expect(await spend(['4'])).toBe('Salvato: −4,00 € · Spesa. Budget di Spesa: 90% usato.')
    // Still near: no second warning.
    expect(await spend(['1'])).toBe('Salvato: −1,00 € · Spesa')
    expect(await spend(['2'])).toBe('Salvato: −2,00 € · Spesa. Budget di Spesa superato di 2,00 €.')
  })

  it('warns for the total, and prefers the category at the same level', async () => {
    await setBudget({
      month,
      categoryId: null,
      amountCents: 1000,
      repeat: true,
    })
    expect(await spend(['9'], 'Casa')).toBe('Salvato: −9,00 € · Casa. Budget del mese: 90% usato.')
    await setBudget({
      month,
      categoryId: expenseCategories[0]!.id,
      amountCents: 100,
      repeat: true,
    })
    expect(await spend(['2'])).toBe('Salvato: −2,00 € · Spesa. Budget di Spesa superato di 1,00 €.')
  })

  it('says nothing for an income', async () => {
    await setBudget({
      month,
      categoryId: null,
      amountCents: 100,
      repeat: true,
    })
    const { wrapper } = await mountEditor({ mode: 'new', kind: 'income' }, 4)
    await press(wrapper, ['9'])
    await tapCategory(wrapper, 'Stipendio')
    await vi.waitFor(() => expect(toastMessage()).toBe('Salvato: +9,00 € · Stipendio'))
  })
})
