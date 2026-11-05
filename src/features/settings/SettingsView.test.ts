import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { db } from '@/db/database'
import { archiveCategory, listCategories } from '@/db/repositories/categories'
import { seedDefaults } from '@/db/seed'
import { applyLocale, LOCALE_STORAGE_KEY } from '@/i18n/locale'
import { testPlugins } from '@/test/plugins'
import SettingsView from './SettingsView.vue'

// happy-dom has no ARIA reflection, so aria-pressed shows up only as the "pressed" class.
function pressedLabel(wrapper: ReturnType<typeof mountSettings>) {
  return wrapper.findAll('button').filter(button => button.classes('pressed')).map(button => button.text())
}

function mountSettings() {
  return mount(SettingsView, {
    global: {
      plugins: testPlugins(createAppRouter(createMemoryHistory())),
    },
  })
}

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
})

afterEach(() => {
  localStorage.clear()
  applyLocale('it')
})

describe('settingsView', () => {
  it('offers automatic, Italian and English', () => {
    const wrapper = mountSettings()
    const labels = wrapper.findAll('button').map(button => button.text())
    expect(labels).toEqual(['Automatica', 'Italiano', 'English'])
    expect(pressedLabel(wrapper)).toEqual(['Automatica'])
  })

  it('opens the categories, counting those in the quick add', async () => {
    const [groceries] = await listCategories({ kind: 'expense' })
    await archiveCategory(groceries!.id)
    const wrapper = mountSettings()
    const row = wrapper.get('[aria-labelledby="settings-categories"] a')
    expect(row.attributes('href')).toBe('/impostazioni/categorie')
    await vi.waitFor(() => expect(row.text()).toContain('11 uscite · 4 entrate'))
  })

  it('shows the app version', () => {
    const wrapper = mountSettings()
    const about = wrapper.get('[aria-labelledby="settings-about"]')
    expect(about.text()).toContain(`Versione ${__APP_VERSION__}`)
  })

  it('switches the language and remembers it', async () => {
    const wrapper = mountSettings()
    const english = wrapper.findAll('button').find(button => button.text() === 'English')
    await english?.trigger('click')
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Settings')
    expect(pressedLabel(wrapper)).toEqual(['English'])
    expect(document.documentElement.lang).toBe('en')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
  })
})
