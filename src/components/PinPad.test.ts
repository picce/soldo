import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { testPlugins } from '@/test/plugins'
import PinPad from './PinPad.vue'

describe('pinPad', () => {
  it('emits the digits and delete, with a name for every key', async () => {
    const wrapper = mount(PinPad, {
      global: {
        plugins: testPlugins(),
      },
    })
    const keys = wrapper.findAll('button')
    expect(keys.map(key => key.text() || key.attributes('aria-label'))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '0',
      'Cancella',
    ])
    await keys[6]!.trigger('click')
    await keys[9]!.trigger('click')
    await keys[10]!.trigger('click')
    expect(wrapper.emitted('digit')).toEqual([
      ['7'],
      ['0'],
    ])
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })

  it('emits nothing while disabled', async () => {
    const wrapper = mount(PinPad, {
      props: { disabled: true },
      global: {
        plugins: testPlugins(),
      },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('digit')).toBeUndefined()
  })
})
