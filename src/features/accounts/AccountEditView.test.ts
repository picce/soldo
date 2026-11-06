import type { VueWrapper } from '@vue/test-utils'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { dismissToast, runToastAction, useToast } from '@/app/toast'
import { db } from '@/db/database'
import { createAccount, getAccount, getDefaultAccount, listAccounts } from '@/db/repositories/accounts'
import { listPaymentMethods, updatePaymentMethod } from '@/db/repositories/payment-methods'
import { addTransaction } from '@/db/repositories/transactions'
import { seedDefaults } from '@/db/seed'
import { useAccountFilterStore } from '@/stores/account-filter'
import { testPlugins } from '@/test/plugins'
import AccountEditView from './AccountEditView.vue'

const BANK = {
  name: 'Banca',
  icon: 'bank',
  color: 7,
  initialBalanceCents: 120000,
} as const

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
})

afterEach(() => dismissToast())

async function mountEditor(id: string | null) {
  const router = createAppRouter(createMemoryHistory())
  await router.push('/impostazioni/conti')
  await router.push(id
    ? `/impostazioni/conti/${id}`
    : '/impostazioni/conti/nuovo')
  const wrapper = mount(AccountEditView, {
    props: { id },
    global: {
      plugins: testPlugins(router),
    },
  })
  await vi.waitFor(() => expect(wrapper.find('input[type="text"]').exists()).toBe(true))
  await flushPromises()
  return { wrapper, router }
}

function button(wrapper: VueWrapper, label: string) {
  return wrapper.findAll('button').find(item => item.text() === label || item.attributes('aria-label') === label)
}

function fields(wrapper: VueWrapper) {
  const [name, balance] = wrapper.findAll('input[type="text"]')
  return { name: name!, balance: balance! }
}

describe('accountEditView', () => {
  it('creates an account with a negative initial balance', async () => {
    const { wrapper } = await mountEditor(null)
    expect(wrapper.get('h1').text()).toBe('Nuovo conto')
    await fields(wrapper).name.setValue('Carta di credito')
    await fields(wrapper).balance.setValue('1.234,50')
    await button(wrapper, 'In rosso')!.trigger('click')
    await button(wrapper, 'Salva')!.trigger('click')
    await vi.waitFor(async () => expect(await listAccounts()).toHaveLength(2))
    expect((await listAccounts())[1]).toMatchObject({ name: 'Carta di credito', initialBalanceCents: -123450 })
    expect(useToast().toast.value?.message).toBe('Aggiunto: Carta di credito')
  })

  it('refuses a missing or repeated name and an amount that is not one', async () => {
    const { wrapper } = await mountEditor(null)
    await button(wrapper, 'Salva')!.trigger('click')
    expect(wrapper.text()).toContain('Scrivi un nome.')
    await fields(wrapper).name.setValue('CONTANTI')
    expect(wrapper.text()).toContain('C\'è già un conto con questo nome.')
    await fields(wrapper).name.setValue('Banca')
    await fields(wrapper).balance.setValue('12,3,4')
    expect(wrapper.text()).toContain('Scrivi un importo valido')
    await button(wrapper, 'Salva')!.trigger('click')
    await flushPromises()
    expect(await listAccounts()).toHaveLength(1)
  })

  it('shows the saved balance and changes it', async () => {
    const bank = await createAccount({ ...BANK, initialBalanceCents: -5050 })
    const { wrapper } = await mountEditor(bank.id)
    expect((fields(wrapper).balance.element as HTMLInputElement).value).toBe('50,50')
    // The sign stays until it is changed.
    await fields(wrapper).balance.setValue('10')
    await button(wrapper, 'Salva')!.trigger('click')
    await vi.waitFor(async () => expect((await getAccount(bank.id))?.initialBalanceCents).toBe(-1000))
  })

  it('protects the last active account: no archive, no delete', async () => {
    const { wrapper } = await mountEditor((await getDefaultAccount())!.id)
    expect(button(wrapper, 'Archivia')).toBeUndefined()
    expect(button(wrapper, 'Elimina conto')).toBeUndefined()
    expect(wrapper.text()).toContain('È l\'unico conto attivo')
  })

  it('offers the trash only for an account never used', async () => {
    const bank = await createAccount(BANK)
    const unused = await mountEditor(bank.id)
    expect(button(unused.wrapper, 'Elimina conto')).toBeDefined()
    expect(button(unused.wrapper, 'Vedi movimenti')).toBeUndefined()
    unused.wrapper.unmount()

    await addTransaction({
      kind: 'expense',
      amountCents: 100,
      date: '2026-11-06',
      accountId: bank.id,
      categoryId: 'groceries',
      note: '',
    })
    const used = await mountEditor(bank.id)
    expect(button(used.wrapper, 'Elimina conto')).toBeUndefined()
    expect(used.wrapper.text()).toContain('Usato in 1 movimento')
  })

  it('archives, says where the payment methods went, and «Annulla» brings all back', async () => {
    const bank = await createAccount(BANK)
    const [method] = await listPaymentMethods()
    await updatePaymentMethod(method!.id, { accountId: bank.id })

    const { wrapper } = await mountEditor(bank.id)
    await button(wrapper, 'Archivia')!.trigger('click')
    await vi.waitFor(async () => expect((await getAccount(bank.id))?.archived).toBe(true))
    await flushPromises()
    expect(useToast().toast.value?.message).toBe('Archiviato: Banca. I suoi pagamenti passano a Contanti.')

    await runToastAction()
    await vi.waitFor(async () => expect((await getAccount(bank.id))?.archived).toBe(false))
    expect((await listPaymentMethods()).find(item => item.id === method!.id)?.accountId).toBe(bank.id)
  })

  it('opens Movimenti on the account', async () => {
    const bank = await createAccount(BANK)
    await addTransaction({
      kind: 'expense',
      amountCents: 100,
      date: '2026-11-06',
      accountId: bank.id,
      categoryId: 'groceries',
      note: '',
    })
    const { wrapper, router } = await mountEditor(bank.id)
    await button(wrapper, 'Vedi movimenti')!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('transactions'))
    expect(useAccountFilterStore().accountId).toBe(bank.id)
  })
})
