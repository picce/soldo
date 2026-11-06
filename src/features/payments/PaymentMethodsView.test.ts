import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { db } from '@/db/database'
import { paymentMethodName } from '@/db/names'
import { createAccount } from '@/db/repositories/accounts'
import { archivePaymentMethod, listPaymentMethods, updatePaymentMethod } from '@/db/repositories/payment-methods'
import { seedDefaults } from '@/db/seed'
import { testPlugins } from '@/test/plugins'
import PaymentMethodsView from './PaymentMethodsView.vue'

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
})

async function mountList() {
  const router = createAppRouter(createMemoryHistory())
  await router.push('/impostazioni/pagamenti')
  const wrapper = mount(PaymentMethodsView, {
    global: {
      plugins: testPlugins(router),
    },
    attachTo: document.body,
  })
  await vi.waitFor(() => expect(wrapper.findAll('.payment-link').length).toBeGreaterThan(0))
  await flushPromises()
  return wrapper
}

describe('paymentMethodsView', () => {
  it('shows the linked account, unless its name would repeat', async () => {
    const bank = await createAccount({
      name: 'Banca',
      icon: 'bank',
      color: 7,
      initialBalanceCents: 0,
    })
    const card = (await listPaymentMethods()).find(method => method.preset === 'card')!
    await updatePaymentMethod(card.id, { accountId: bank.id })

    const wrapper = await mountList()
    await vi.waitFor(() => {
      const rows = wrapper.findAll('.payment-link').map(row => row.get('.payment-link__text').text())
      expect(rows[0]).toBe('Contanti')
      expect(rows[1]).toBe('CartaBanca')
    })
    wrapper.unmount()
  })

  it('keeps archived methods in a section of their own', async () => {
    const [first] = await listPaymentMethods()
    await archivePaymentMethod(first!.id)
    const wrapper = await mountList()
    expect(wrapper.get('.archived-section').text()).toContain('Archiviati (1)')
    wrapper.unmount()
  })

  it('moves a row with the buttons', async () => {
    const wrapper = await mountList()
    await wrapper.get('button[aria-label="Sposta giù: Contanti"]').trigger('click')
    await vi.waitFor(async () => expect((await listPaymentMethods()).slice(0, 2).map(paymentMethodName)).toEqual(['Carta', 'Contanti']))
    wrapper.unmount()
  })
})
