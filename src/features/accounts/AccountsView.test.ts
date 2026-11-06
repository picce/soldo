import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { db } from '@/db/database'
import { accountName } from '@/db/names'
import { archiveAccount, createAccount, getDefaultAccount, listAccounts } from '@/db/repositories/accounts'
import { addTransaction } from '@/db/repositories/transactions'
import { seedDefaults } from '@/db/seed'
import { addDays, today } from '@/domain/dates'
import { testPlugins } from '@/test/plugins'
import AccountsView from './AccountsView.vue'

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
})

async function mountAccounts() {
  const router = createAppRouter(createMemoryHistory())
  await router.push('/impostazioni/conti')
  const wrapper = mount(AccountsView, {
    global: {
      plugins: testPlugins(router),
    },
    attachTo: document.body,
  })
  await vi.waitFor(() => expect(wrapper.findAll('.account-link').length).toBeGreaterThan(0))
  await flushPromises()
  return wrapper
}

function clean(text: string) {
  return text.replace(/\s+/g, ' ')
}

describe('accountsView', () => {
  it('shows each balance, the total of the active accounts and which one is the default', async () => {
    const cash = (await getDefaultAccount())!
    const bank = await createAccount({
      name: 'Banca',
      icon: 'bank',
      color: 7,
      initialBalanceCents: 100000,
    })
    await addTransaction({
      kind: 'expense',
      amountCents: 2000,
      date: today(),
      accountId: bank.id,
      categoryId: 'groceries',
      note: '',
    })
    await addTransaction({
      kind: 'transfer',
      amountCents: 5000,
      date: today(),
      accountId: bank.id,
      toAccountId: cash.id,
      categoryId: null,
      note: '',
    })
    // Next week: it does not count yet.
    await addTransaction({
      kind: 'expense',
      amountCents: 999,
      date: addDays(today(), 7),
      accountId: bank.id,
      categoryId: 'groceries',
      note: '',
    })

    const wrapper = await mountAccounts()
    // A transfer stays in the total: 1.000 less the expense of 20.
    await vi.waitFor(() => expect(clean(wrapper.get('.accounts__total').text())).toContain('980,00 €'))
    const rows = wrapper.findAll('.sortable-row')
    expect(clean(rows[0]!.text())).toContain('Contanti')
    expect(clean(rows[0]!.text())).toContain('Predefinito')
    expect(clean(rows[0]!.text())).toContain('50,00')
    expect(clean(rows[1]!.text())).toContain('930,00')
    expect(clean(rows[1]!.text())).not.toContain('Predefinito')
  })

  it('leaves archived accounts out of the total, in a section of their own', async () => {
    const bank = await createAccount({
      name: 'Banca',
      icon: 'bank',
      color: 7,
      initialBalanceCents: 100000,
    })
    await archiveAccount(bank.id)
    const wrapper = await mountAccounts()
    expect(clean(wrapper.get('.accounts__total').text())).toContain('0,00 €')
    expect(wrapper.get('.archived-section').text()).toContain('Archiviati (1)')
    expect(wrapper.get('.accounts__archived').text()).toContain('Banca')
  })

  it('moves a row with the buttons, and the first becomes the default', async () => {
    await createAccount({
      name: 'Banca',
      icon: 'bank',
      color: 7,
      initialBalanceCents: 0,
    })
    const wrapper = await mountAccounts()
    await wrapper.get('button[aria-label="Sposta giù: Contanti"]').trigger('click')
    await vi.waitFor(async () => expect((await listAccounts()).map(accountName)).toEqual(['Banca', 'Contanti']))
    expect(wrapper.get('[aria-live="polite"]').text()).toBe('Contanti: posizione 2 di 2')
    wrapper.unmount()
  })
})
