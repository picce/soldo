import type { VueWrapper } from '@vue/test-utils'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { dismissToast, runToastAction, useToast } from '@/app/toast'
import { db } from '@/db/database'
import { createAccount, getDefaultAccount } from '@/db/repositories/accounts'
import { archivePaymentMethod, getPaymentMethod, listPaymentMethods } from '@/db/repositories/payment-methods'
import { addTransaction } from '@/db/repositories/transactions'
import { seedDefaults } from '@/db/seed'
import { testPlugins } from '@/test/plugins'
import PaymentMethodEditView from './PaymentMethodEditView.vue'

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
})

afterEach(() => dismissToast())

async function mountEditor(id: string | null) {
  const router = createAppRouter(createMemoryHistory())
  await router.push('/impostazioni/pagamenti')
  await router.push(id
    ? `/impostazioni/pagamenti/${id}`
    : '/impostazioni/pagamenti/nuovo')
  const wrapper = mount(PaymentMethodEditView, {
    props: { id },
    global: {
      plugins: testPlugins(router),
    },
  })
  await vi.waitFor(() => expect(wrapper.find('input[type="text"]').exists()).toBe(true))
  await flushPromises()
  return wrapper
}

function button(wrapper: VueWrapper, label: string) {
  return wrapper.findAll('button').find(item => item.text() === label || item.attributes('aria-label') === label)
}

describe('paymentMethodEditView', () => {
  it('creates a method on the default account', async () => {
    const account = (await getDefaultAccount())!
    const wrapper = await mountEditor(null)
    await wrapper.get('input[type="text"]').setValue('Buoni pasto')
    await wrapper.get('input[type="radio"][value="money"]').setValue()
    await button(wrapper, 'Salva')!.trigger('click')
    await vi.waitFor(async () => expect(await listPaymentMethods()).toHaveLength(6))
    expect((await listPaymentMethods())[5]).toMatchObject({ name: 'Buoni pasto', icon: 'money', accountId: account.id })
  })

  it('refuses a repeated name', async () => {
    const wrapper = await mountEditor(null)
    await wrapper.get('input[type="text"]').setValue('carta')
    expect(wrapper.text()).toContain('C\'è già un pagamento con questo nome.')
  })

  it('asks for the account only with two active accounts', async () => {
    const [method] = await listPaymentMethods()
    const single = await mountEditor(method!.id)
    expect(single.find('.payment-edit__account').exists()).toBe(false)
    single.unmount()

    await createAccount({
      name: 'Banca',
      icon: 'bank',
      color: 7,
      initialBalanceCents: 0,
    })
    const two = await mountEditor(method!.id)
    expect(two.get('.payment-edit__account').text()).toContain('Contanti')
  })

  it('offers the trash only for a method never used, and «Annulla» restores it', async () => {
    const [method] = await listPaymentMethods()
    const wrapper = await mountEditor(method!.id)
    await button(wrapper, 'Elimina pagamento')!.trigger('click')
    await vi.waitFor(async () => expect(await getPaymentMethod(method!.id)).toBeUndefined())
    await flushPromises()
    expect(useToast().toast.value?.message).toBe('Eliminato: Contanti')
    await runToastAction()
    await vi.waitFor(async () => expect(await getPaymentMethod(method!.id)).toBeDefined())
    wrapper.unmount()

    await addTransaction({
      kind: 'expense',
      amountCents: 100,
      date: '2026-11-06',
      accountId: method!.accountId,
      categoryId: 'groceries',
      note: '',
      paymentMethodId: method!.id,
    })
    const used = await mountEditor(method!.id)
    expect(button(used, 'Elimina pagamento')).toBeUndefined()
    expect(used.text()).toContain('Usato in 1 spesa')
  })

  it('protects the last active method', async () => {
    const methods = await listPaymentMethods()
    for (const method of methods.slice(1))
      await archivePaymentMethod(method.id)
    const wrapper = await mountEditor(methods[0]!.id)
    expect(button(wrapper, 'Archivia')).toBeUndefined()
    expect(button(wrapper, 'Elimina pagamento')).toBeUndefined()
    expect(wrapper.text()).toContain('È l\'unico pagamento attivo')
  })
})
