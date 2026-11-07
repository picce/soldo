import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { testPlugins } from '@/test/plugins'
import BarChart from './BarChart.vue'
import LineChart from './LineChart.vue'

const euros = (cents: number) => `${cents / 100} €`

describe('lineChart', () => {
  function mountLine() {
    return mount(LineChart, {
      props: {
        'label': 'Uscite giorno per giorno',
        'series': [
          {
            key: 'now',
            label: 'novembre',
            values: [100, 300, 600],
            color: 'var(--color-chart-expense)',
          },
          {
            key: 'before',
            label: 'ottobre',
            values: [200, 200, 500, 900],
            color: 'var(--color-ink-2)',
            dashed: true,
          },
        ],
        'length': 4,
        'ticks': [0, 3],
        'tickLabel': (index: number) => String(index + 1),
        'pointLabel': (index: number) => `${index + 1} nov`,
        'formatValue': euros,
        'formatTick': euros,
        'marker': 2,
        'selected': null,
        'onUpdate:selected': () => {},
      },
      global: {
        plugins: testPlugins(),
      },
    })
  }

  it('puts every value in a table for screen readers, and hides the drawing', () => {
    const wrapper = mountLine()
    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('caption').text()).toBe('Uscite giorno per giorno')
    expect(wrapper.findAll('tbody tr').map(row => row.findAll('th, td').map(cell => cell.text()).join(' | '))).toEqual([
      '1 nov | 1 € | 2 €',
      '2 nov | 3 € | 2 €',
      '3 nov | 6 € | 5 €',
      '4 nov |  | 9 €',
    ])
  })

  it('reads a point with the arrow keys, from today, and lets go with Escape', async () => {
    const wrapper = mountLine()
    const chart = wrapper.get('[role="group"]')
    expect(chart.attributes('aria-label')).toBe('Uscite giorno per giorno')
    await chart.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('update:selected')!.at(-1)).toEqual([2])
    await wrapper.setProps({ selected: 2 })
    await chart.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('update:selected')!.at(-1)).toEqual([1])
    await chart.trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update:selected')!.at(-1)).toEqual([3])
    await chart.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('update:selected')!.at(-1)).toEqual([null])
  })

  it('draws a guide on the chosen point, and a dot on today otherwise', async () => {
    const wrapper = mountLine()
    expect(wrapper.findAll('circle')).toHaveLength(1)
    expect(wrapper.find('.line-chart__guide').exists()).toBe(false)
    await wrapper.setProps({ selected: 1 })
    expect(wrapper.findAll('circle')).toHaveLength(2)
    expect(wrapper.find('.line-chart__guide').exists()).toBe(true)
  })
})

describe('barChart', () => {
  function mountBars(props: Record<string, unknown> = {}) {
    return mount(BarChart, {
      props: {
        label: 'Entrate e uscite mese per mese',
        series: [
          {
            key: 'income',
            label: 'Entrate',
            values: [1000, 0, 1500],
            color: 'var(--color-chart-income)',
          },
          {
            key: 'expense',
            label: 'Uscite',
            values: [800, 300, 0],
            color: 'var(--color-chart-expense)',
          },
        ],
        labels: ['G', 'F', 'M'],
        pointLabel: (index: number) => ['gennaio', 'febbraio', 'marzo'][index]!,
        formatValue: euros,
        formatTick: euros,
        ...props,
      },
      global: {
        plugins: testPlugins(),
      },
    })
  }

  it('draws a bar for each value above zero, and a table with all of them', () => {
    const wrapper = mountBars()
    expect(wrapper.findAll('.bar-chart__bar')).toHaveLength(4)
    expect(wrapper.findAll('tbody tr').map(row => row.findAll('th, td').map(cell => cell.text()).join(' | '))).toEqual([
      'gennaio | 10 € | 8 €',
      'febbraio | 0 € | 3 €',
      'marzo | 15 € | 0 €',
    ])
  })

  it('dims the other months around the one chosen or standing out', async () => {
    const wrapper = mountBars({ emphasis: 2 })
    expect(wrapper.findAll('.bar-chart__bar--dim')).toHaveLength(3)
    await wrapper.setProps({ selected: 0 })
    expect(wrapper.findAll('.bar-chart__bar--dim')).toHaveLength(2)
    expect(wrapper.get('.bar-chart__tick--on').text()).toBe('G')
  })

  it('draws the average with its name', () => {
    const wrapper = mountBars({ average: 900, averageLabel: 'media' })
    expect(wrapper.find('.bar-chart__average').exists()).toBe(true)
    expect(wrapper.text()).toContain('media')
  })
})
