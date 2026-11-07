import type { Period } from '@/domain/periods'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { applyLocale } from '@/i18n/locale'
import { testPlugins } from '@/test/plugins'
import PeriodSwitcher from './PeriodSwitcher.vue'

function mountSwitcher(period: Period) {
  return mount(PeriodSwitcher, {
    props: { period },
    global: {
      plugins: testPlugins(),
    },
    attachTo: document.body,
  })
}

afterEach(() => applyLocale('it'))

describe('periodSwitcher', () => {
  it('shows the tabs and the title of the period', () => {
    const wrapper = mountSwitcher({ unit: 'month', anchor: '2026-11-05' })
    expect(wrapper.findAll('[role="tab"]').map(tab => tab.text())).toEqual(['Giorno', 'Settimana', 'Mese', 'Anno'])
    expect(wrapper.get('[aria-selected="true"]').text()).toBe('Mese')
    expect(wrapper.get('h2').text()).toBe('Novembre 2026')
  })

  it('emits the unit and the moves', async () => {
    const wrapper = mountSwitcher({ unit: 'month', anchor: '2026-11-05' })
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await wrapper.get('button[aria-label="Periodo precedente"]').trigger('click')
    await wrapper.get('button[aria-label="Periodo successivo"]').trigger('click')
    expect(wrapper.emitted('update:unit')).toEqual([
      ['week'],
    ])
    expect(wrapper.emitted('shift')).toEqual([
      [-1],
      [1],
    ])
  })

  it('moves between tabs with the arrow keys', async () => {
    const wrapper = mountSwitcher({ unit: 'day', anchor: '2026-11-05' })
    await wrapper.get('[role="tablist"]').trigger('keydown', { key: 'ArrowLeft' })
    await wrapper.get('[role="tablist"]').trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update:unit')).toEqual([
      ['year'],
      ['year'],
    ])
  })

  it('names the period in English', async () => {
    const wrapper = mountSwitcher({ unit: 'week', anchor: '2026-11-05' })
    applyLocale('en')
    await nextTick()
    expect(wrapper.get('[aria-selected="true"]').text()).toBe('Week')
    expect(wrapper.get('h2').text()).toBe('2–8 November')
  })
})

describe('periodSwitcher without tabs', () => {
  it('keeps only the title and the arrows', async () => {
    const wrapper = mount(PeriodSwitcher, {
      props: {
        period: { unit: 'month', anchor: '2026-11-05' },
        showTabs: false,
      },
      global: {
        plugins: testPlugins(),
      },
    })
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    expect(wrapper.get('h2').text()).toBe('Novembre 2026')
    await wrapper.get('button[aria-label="Periodo successivo"]').trigger('click')
    expect(wrapper.emitted('shift')).toEqual([
      [1],
    ])
  })
})

describe('periodSwitcher with fewer units', () => {
  it('offers only the units asked for, and the keys move among them', async () => {
    const wrapper = mount(PeriodSwitcher, {
      props: {
        period: { unit: 'month', anchor: '2026-11-01' },
        units: ['month', 'year'],
      },
      global: {
        plugins: testPlugins(),
      },
      attachTo: document.body,
    })
    expect(wrapper.findAll('[role="tab"]').map(tab => tab.text())).toEqual(['Mese', 'Anno'])
    await wrapper.get('[role="tablist"]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:unit')).toEqual([
      ['year'],
    ])
    wrapper.unmount()
  })
})
