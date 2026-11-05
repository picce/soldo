import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { applyLocale } from '@/i18n/locale'
import { testPlugins } from '@/test/plugins'
import Keypad from './Keypad.vue'

function mountKeypad() {
  return mount(Keypad, {
    global: {
      plugins: testPlugins(),
    },
  })
}

afterEach(() => applyLocale('it'))

describe('keypad', () => {
  it('has sixteen keys in the order of the mockup', () => {
    const keys = mountKeypad().findAll('button')
    expect(keys.map(key => key.attributes('aria-label') ?? key.text())).toEqual([
      '7',
      '8',
      '9',
      'Diviso',
      '4',
      '5',
      '6',
      'Per',
      '1',
      '2',
      '3',
      'Meno',
      'Virgola',
      '0',
      'Cancella',
      'Più',
    ])
  })

  it('emits the pressed key', async () => {
    const wrapper = mountKeypad()
    await wrapper.get('button[aria-label="Diviso"]').trigger('click')
    await wrapper.findAll('button').find(key => key.text() === '7')!.trigger('click')
    await wrapper.get('button[aria-label="Virgola"]').trigger('click')
    await wrapper.get('button[aria-label="Cancella"]').trigger('click')
    expect(wrapper.emitted('press')).toEqual([
      ['/'],
      ['7'],
      ['decimal'],
      ['backspace'],
    ])
  })

  it('shows the decimal separator of the language', async () => {
    const wrapper = mountKeypad()
    expect(wrapper.get('button[aria-label="Virgola"]').text()).toBe(',')
    applyLocale('en')
    await nextTick()
    expect(wrapper.get('button[aria-label="Decimal point"]').text()).toBe('.')
  })
})
