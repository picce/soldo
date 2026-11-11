import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { db } from '@/db/database'
import { saveImportRule } from '@/db/repositories/import'
import { seedDefaults } from '@/db/seed'
import { testPlugins } from '@/test/plugins'
import ImportRulesView from './ImportRulesView.vue'
import ImportView from './ImportView.vue'

const STATEMENT = [
  'Data;Descrizione;Importo',
  '02/03/2026;PAGAMENTO POS ESSELUNGA MILANO;-45,90',
  '05/03/2026;BONIFICO DA ACME SRL;1.850,00',
].join('\n')

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
})

async function mountPage(component: typeof ImportView | typeof ImportRulesView, path: string) {
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  const wrapper = mount(component, { global: { plugins: testPlugins(router) }, attachTo: document.body })
  await flushPromises()
  return { wrapper, router }
}

async function chooseFile(wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper'], text: string, name = 'marzo.csv') {
  const input = wrapper.find<HTMLInputElement>('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [new File([text], name, { type: 'text/csv' })], configurable: true })
  await input.trigger('change')
}

describe('import page', () => {
  it('goes from the file to the account, the columns and the preview', async () => {
    const { wrapper, router } = await mountPage(ImportView, '/impostazioni/importa')
    await chooseFile(wrapper, STATEMENT)
    await vi.waitFor(() => expect(router.currentRoute.value.query.passo).toBe('conto'))
    await flushPromises()

    await wrapper.findAll('.choice-list__row')[0]!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.passo).toBe('colonne'))
    await flushPromises()
    expect(wrapper.text()).toContain('2 movimenti letti')
    expect(wrapper.text()).toContain('Date lette come giorno/mese/anno.')

    await wrapper.find('.import__action').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.passo).toBe('anteprima'))
    await flushPromises()
    expect(wrapper.findAll('.import-row').map(row => row.text())).toEqual([
      expect.stringMatching(/BONIFICO DA ACME SRL.*Altre entrate/),
      expect.stringMatching(/ESSELUNGA.*Altro/),
    ])
    expect(wrapper.find('.import__action').text()).toBe('Importa 2 movimenti')
    wrapper.unmount()
  })

  it('says why a file cannot be read', async () => {
    const { wrapper } = await mountPage(ImportView, '/impostazioni/importa')
    await chooseFile(wrapper, 'nothing to see', 'note.txt')
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').text()).toBe('In questo file non trovo una tabella con date e importi.'))
    wrapper.unmount()
  })

  it('starts again from the file when a step is opened without one', async () => {
    const { wrapper, router } = await mountPage(ImportView, '/impostazioni/importa?passo=anteprima')
    await vi.waitFor(() => expect(router.currentRoute.value.query.passo).toBeUndefined())
    wrapper.unmount()
  })
})

describe('rules page', () => {
  it('explains how rules are made, then lists them by keyword', async () => {
    const empty = await mountPage(ImportRulesView, '/impostazioni/regole')
    await vi.waitFor(() => expect(empty.wrapper.text()).toContain('Nessuna regola per ora'))
    empty.wrapper.unmount()

    const groceries = (await db.categories.toArray()).find(category => category.preset === 'groceries')!
    await saveImportRule({ pattern: 'Esselunga', kind: 'expense', categoryId: groceries.id })
    await saveImportRule({ pattern: 'Coop', kind: 'expense', categoryId: groceries.id })
    const { wrapper } = await mountPage(ImportRulesView, '/impostazioni/regole')
    await vi.waitFor(() => expect(wrapper.findAll('.import-rules__row').map(row => row.text())).toEqual([
      expect.stringMatching(/«Coop».*Spesa · Uscite/),
      expect.stringMatching(/«Esselunga».*Spesa · Uscite/),
    ]))
    wrapper.unmount()
  })
})
