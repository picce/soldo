import type { VueWrapper } from '@vue/test-utils'
import type { EditorTarget } from './useTransactionEditor'
import type { RecurrenceInput } from '@/db/repositories/recurrences'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { dismissToast, runToastAction, useToast } from '@/app/toast'
import { db } from '@/db/database'
import { listCategories } from '@/db/repositories/categories'
import { listPaymentMethods } from '@/db/repositories/payment-methods'
import {
  createRecurrence,
  generateDueOccurrences,
  getRecurrence,
  listRecurrences,
} from '@/db/repositories/recurrences'
import { listTransactions } from '@/db/repositories/transactions'
import { seedDefaults } from '@/db/seed'
import { testPlugins } from '@/test/plugins'
import TransactionEditorView from './TransactionEditorView.vue'

/** Series on the quick-add screen (docs/specs/released/ricorrenze.md); today is Saturday 7 November 2026. */

const { toast } = useToast()

function toastMessage() {
  return toast.value?.message.replace(/\s/g, ' ')
}

beforeEach(async () => {
  vi.useFakeTimers({
    toFake: ['Date'],
  })
  vi.setSystemTime(new Date(2026, 10, 7, 10))
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
})

afterEach(() => {
  dismissToast()
  vi.useRealTimers()
})

async function mountEditor(target: EditorTarget) {
  const router = createAppRouter(createMemoryHistory())
  await router.push('/')
  const wrapper = mount(TransactionEditorView, {
    props: { target },
    global: {
      plugins: testPlugins(router),
    },
    attachTo: document.body,
  })
  await vi.waitFor(() => expect(wrapper.findAll('.category-grid__item').length).toBeGreaterThan(0))
  await flushPromises()
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
  await wrapper.findAll('.category-grid__item').find(button => button.text() === name)!.trigger('click')
  await flushPromises()
}

function button(wrapper: VueWrapper, text: string) {
  return wrapper.findAll('button').find(item => item.text() === text)
}

function dateChip(wrapper: VueWrapper) {
  return wrapper.get('.editor__date-chip')
}

async function openDateSheet(wrapper: VueWrapper) {
  await dateChip(wrapper).trigger('click')
  await flushPromises()
}

/** Rent: 750 € on the 1st of the month in Casa, with the first payment method. */
async function rent(changes: Partial<RecurrenceInput> = {}) {
  const [, home] = await listCategories({ kind: 'expense' })
  const [method] = await listPaymentMethods()
  return createRecurrence({
    template: {
      kind: 'expense',
      amountCents: 75000,
      accountId: method!.accountId,
      paymentMethodId: method!.id,
      categoryId: home!.id,
      note: 'Affitto',
    },
    freq: 'monthly',
    interval: 1,
    startDate: '2026-09-01',
    ...changes,
  })
}

describe('a new series', () => {
  it('starts from today: the transaction is there at once, and the notice says it repeats', async () => {
    const { wrapper } = await mountEditor({ mode: 'new', kind: 'expense', repeat: 'monthly' })
    expect(dateChip(wrapper).text()).toBe('Oggi · mensile')
    await press(wrapper, ['7', '5', '0'])
    await tapCategory(wrapper, 'Casa')
    await vi.waitFor(() => expect(toastMessage()).toBe('Salvato: −750,00 € · Casa. Si ripete ogni mese.'))

    const [series] = await listRecurrences()
    expect(series).toMatchObject({
      freq: 'monthly',
      interval: 1,
      startDate: '2026-11-07',
      template: { amountCents: 75000 },
    })
    expect(await listTransactions()).toMatchObject([
      { date: '2026-11-07', recurrenceId: series!.id, source: 'recurring' },
    ])
  })

  it('is chosen in the date sheet, every so often, and waits for a later start', async () => {
    const { wrapper } = await mountEditor({ mode: 'new', kind: 'expense' })
    await openDateSheet(wrapper)
    expect(button(wrapper, 'Non si ripete')!.attributes('aria-pressed')).toBe('true')
    await button(wrapper, 'Ogni settimana')!.trigger('click')
    await wrapper.get('input[inputmode="numeric"]').setValue('2')
    await wrapper.get('#date-sheet-other').setValue('2026-12-01')
    await button(wrapper, 'Fatto')!.trigger('click')
    await flushPromises()
    expect(dateChip(wrapper).text()).toBe('1 dic · ogni 2 settimane')

    await press(wrapper, ['1', '2'])
    await tapCategory(wrapper, 'Spesa')
    await vi.waitFor(() => expect(toastMessage()).toBe('Programmato: −12,00 € · Spesa, dal 1 dicembre, ogni 2 settimane.'))
    expect(await listRecurrences()).toMatchObject([
      { freq: 'weekly', interval: 2, startDate: '2026-12-01' },
    ])
    expect(await listTransactions()).toEqual([])
  })

  it('does not end before it starts', async () => {
    const { wrapper } = await mountEditor({ mode: 'new', kind: 'expense', repeat: 'monthly' })
    await openDateSheet(wrapper)
    await wrapper.findAll('input[type="date"]').at(-1)!.setValue('2026-11-01')
    await button(wrapper, 'Fatto')!.trigger('click')
    await press(wrapper, ['5'])
    await tapCategory(wrapper, 'Spesa')
    expect(wrapper.get('[role="alert"]').text()).toBe('La fine viene prima dell\'inizio')
    expect(await listRecurrences()).toEqual([])
  })

  it('can go back to a single transaction', async () => {
    const { wrapper } = await mountEditor({ mode: 'new', kind: 'expense', repeat: 'monthly' })
    await openDateSheet(wrapper)
    await button(wrapper, 'Non si ripete')!.trigger('click')
    await flushPromises()
    expect(dateChip(wrapper).text()).toBe('Oggi')
  })
})

describe('a series', () => {
  it('opens on the screen of the quick add, and changes the next transactions only', async () => {
    const series = await rent()
    await generateDueOccurrences('2026-11-07')
    const { wrapper } = await mountEditor({ mode: 'rule', id: series.id })
    expect(wrapper.get('h1').text()).toBe('Modifica ricorrenza')
    expect(wrapper.get('.editor__line').text()).toBe('Ricorrenza')
    expect(dateChip(wrapper).text()).toBe('1 set · mensile')
    expect(wrapper.text()).toContain('Le modifiche valgono per i prossimi movimenti')

    await openDateSheet(wrapper)
    expect(button(wrapper, 'Non si ripete')).toBeUndefined()
    await button(wrapper, 'Fatto')!.trigger('click')

    await tapCategory(wrapper, 'Spesa')
    await button(wrapper, 'Salva')!.trigger('click')
    await vi.waitFor(() => expect(toastMessage()).toBe('Salvato: −750,00 € · Spesa'))
    const [groceries] = await listCategories({ kind: 'expense' })
    expect((await getRecurrence(series.id))!.template.categoryId).toBe(groceries!.id)
    expect((await listTransactions()).every(transaction => transaction.categoryId !== groceries!.id)).toBe(true)
  })

  it('stops, with «Annulla»', async () => {
    const series = await rent()
    const { wrapper } = await mountEditor({ mode: 'rule', id: series.id })
    await button(wrapper, 'Interrompi')!.trigger('click')
    await vi.waitFor(() => expect(toastMessage()).toBe('Interrotta: Affitto'))
    expect((await getRecurrence(series.id))!.endDate).toBe('2026-11-07')
    await runToastAction()
    expect((await getRecurrence(series.id))!.endDate).toBeUndefined()
  })

  it('resumes when it is over', async () => {
    const series = await rent({ endDate: '2026-10-15' })
    const { wrapper } = await mountEditor({ mode: 'rule', id: series.id })
    expect(button(wrapper, 'Interrompi')).toBeUndefined()
    await button(wrapper, 'Riprendi')!.trigger('click')
    await vi.waitFor(() => expect(toastMessage()).toBe('Ripresa: Affitto'))
    expect((await getRecurrence(series.id))!.endDate).toBeUndefined()
  })

  it('is deleted from the trash, with «Annulla»', async () => {
    const series = await rent({ startDate: '2026-12-01' })
    const { wrapper } = await mountEditor({ mode: 'rule', id: series.id })
    expect(button(wrapper, 'Interrompi')).toBeUndefined()
    await wrapper.get('button[aria-label="Elimina la serie"]').trigger('click')
    await vi.waitFor(() => expect(toastMessage()).toBe('Ricorrenza eliminata: Affitto'))
    expect(await listRecurrences()).toEqual([])
    await runToastAction()
    expect(await listRecurrences()).toHaveLength(1)
  })
})

describe('a transaction of a series', () => {
  it('says which series it belongs to and leads to it, without «Ripeti» for itself', async () => {
    const series = await rent()
    await generateDueOccurrences('2026-11-07')
    const { wrapper } = await mountEditor({ mode: 'edit', id: `${series.id}:2026-11-01` })
    await vi.waitFor(() => expect(wrapper.find('.editor__series').exists()).toBe(true))
    expect(wrapper.get('.editor__series').text()).toContain('Ogni mese')
    expect(wrapper.get('.editor__series a').attributes('href')).toBe(`/ricorrenze/${series.id}`)
    expect(button(wrapper, 'Duplica')).toBeDefined()

    await openDateSheet(wrapper)
    expect(wrapper.text()).not.toContain('Ripeti')
  })
})
