import type { RecurrenceInput } from '@/db/repositories/recurrences'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { db } from '@/db/database'
import { createAccount, getDefaultAccount } from '@/db/repositories/accounts'
import { listCategories } from '@/db/repositories/categories'
import { listPaymentMethods } from '@/db/repositories/payment-methods'
import { createRecurrence, generateDueOccurrences } from '@/db/repositories/recurrences'
import { seedDefaults } from '@/db/seed'
import { testPlugins } from '@/test/plugins'
import RecurrencesView from './RecurrencesView.vue'

beforeEach(async () => {
  vi.useFakeTimers({
    toFake: ['Date'],
  })
  vi.setSystemTime(new Date(2026, 10, 7, 10))
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
})

afterEach(() => vi.useRealTimers())

async function expense(note: string, amountCents: number, changes: Partial<RecurrenceInput> = {}) {
  const [, home] = await listCategories({ kind: 'expense' })
  const [method] = await listPaymentMethods()
  return createRecurrence({
    template: {
      kind: 'expense',
      amountCents,
      accountId: method!.accountId,
      paymentMethodId: method!.id,
      categoryId: home!.id,
      note,
    },
    freq: 'monthly',
    interval: 1,
    startDate: '2026-09-01',
    ...changes,
  })
}

async function mountPage() {
  const router = createAppRouter(createMemoryHistory())
  await router.push('/impostazioni/ricorrenze')
  const wrapper = mount(RecurrencesView, {
    global: {
      plugins: testPlugins(router),
    },
  })
  await vi.waitFor(() => expect(wrapper.find('.recurrences__empty, .recurrences__card').exists()).toBe(true))
  await flushPromises()
  return { wrapper, router }
}

type Page = Awaited<ReturnType<typeof mountPage>>['wrapper']

/** Each row as its pieces of text: day, name, detail, amount. */
function rows(wrapper: Page, selector: string) {
  return wrapper.findAll(selector).map(row => row
    .findAll('.recurrences__day > span, .recurrences__text > span, .amount-text')
    .map(item => item.text().replace(/\s+/g, ' ').trim())
    .join(' | '))
}

describe('recurrencesView', () => {
  it('explains what series are for, and offers a new one', async () => {
    const { wrapper } = await mountPage()
    expect(wrapper.text()).toContain('segnali una volta e Soldo li aggiunge da solo')
    expect(wrapper.get('.recurrences__new').attributes('href')).toBe('/nuovo/uscita?ripeti=mensile')
  })

  it('lists what comes in the next 30 days, the active series and those that are over', async () => {
    const rent = await expense('Affitto', 75000, { startDate: '2026-09-01' })
    await expense('Netflix', 1299, { startDate: '2026-10-09' })
    const bank = await getDefaultAccount()
    const savings = await createAccount({
      name: 'Salvadanaio',
      icon: 'vault',
      color: 3,
      initialBalanceCents: 0,
    })
    await createRecurrence({
      template: {
        kind: 'transfer',
        amountCents: 20000,
        accountId: bank!.id,
        toAccountId: savings.id,
        categoryId: null,
        note: '',
      },
      freq: 'monthly',
      interval: 1,
      startDate: '2026-12-01',
    })
    await expense('Palestra', 4000, { endDate: '2026-10-31' })
    await generateDueOccurrences('2026-11-07')

    const { wrapper } = await mountPage()
    expect(rows(wrapper, '.recurrences__upcoming')).toEqual([
      'lun | 9 nov | Netflix | Ogni mese · Contanti | −12,99',
      'mar | 1 dic | Affitto | Ogni mese · Contanti | −750,00',
      'mar | 1 dic | Trasferimento | Ogni mese · Contanti → Salvadanaio | 200,00',
    ])
    const active = '#recurrences-active + .recurrences__card .recurrences__row'
    expect(rows(wrapper, active)).toEqual([
      'Netflix | Ogni mese · prossimo 9 nov | −12,99',
      'Affitto | Ogni mese · prossimo 1 dic | −750,00',
      'Trasferimento | Ogni mese · dal 1 dic | 200,00',
    ])
    expect(wrapper.findAll(active)[1]!.attributes('href')).toBe(`/ricorrenze/${rent.id}`)
    expect(wrapper.get('.recurrences__finished summary').text()).toBe('Concluse (1)')
    expect(rows(wrapper, '.recurrences__finished .recurrences__row')).toEqual(['Palestra | Ogni mese · conclusa il 31 ott | −40,00'])
  })
})
