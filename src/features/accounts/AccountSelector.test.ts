import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { db } from '@/db/database'
import { archiveAccount, createAccount, deleteAccount } from '@/db/repositories/accounts'
import { seedDefaults } from '@/db/seed'
import { useAccountFilterStore } from '@/stores/account-filter'
import { testPlugins } from '@/test/plugins'
import AccountSelector from './AccountSelector.vue'

const BANK = {
  name: 'Banca',
  icon: 'bank',
  color: 7,
  initialBalanceCents: 0,
} as const

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
})

async function mountSelector() {
  const router = createAppRouter(createMemoryHistory())
  await router.push('/')
  const wrapper = mount(AccountSelector, {
    global: {
      plugins: testPlugins(router),
      stubs: { BottomSheet: true },
    },
  })
  await flushPromises()
  return wrapper
}

describe('accountSelector', () => {
  it('stays out of sight with a single account', async () => {
    const wrapper = await mountSelector()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(wrapper.find('.account-selector').exists()).toBe(false)
  })

  it('shows from the second active account on', async () => {
    await createAccount(BANK)
    const wrapper = await mountSelector()
    await vi.waitFor(() => expect(wrapper.get('.account-selector').text()).toBe('Tutti i conti'))
  })

  it('names the chosen account, archived too, and stays while it is chosen', async () => {
    const bank = await createAccount(BANK)
    const wrapper = await mountSelector()
    useAccountFilterStore().select(bank.id)
    await archiveAccount(bank.id)
    await vi.waitFor(() => expect(wrapper.get('.account-selector').text()).toBe('Banca'))
  })

  it('goes back to all accounts when the chosen one no longer exists', async () => {
    const bank = await createAccount(BANK)
    const wrapper = await mountSelector()
    const store = useAccountFilterStore()
    store.select(bank.id)
    await deleteAccount(bank.id)
    await vi.waitFor(() => expect(store.accountId).toBeNull())
    await vi.waitFor(() => expect(wrapper.find('.account-selector').exists()).toBe(false))
  })
})
