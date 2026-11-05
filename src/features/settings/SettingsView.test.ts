import { VolverPlugin } from '@volverjs/ui-vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '@/i18n'
import { applyLocale, LOCALE_STORAGE_KEY } from '@/i18n/locale'
import SettingsView from './SettingsView.vue'

// happy-dom has no ARIA reflection, so aria-pressed shows up only as the "pressed" class.
function pressedLabel(wrapper: ReturnType<typeof mountSettings>) {
  return wrapper.findAll('button').filter(button => button.classes('pressed')).map(button => button.text())
}

function mountSettings() {
  return mount(SettingsView, {
    global: {
      plugins: [i18n, VolverPlugin],
    },
  })
}

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
