import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { testPlugins } from '@/test/plugins'
import SwipeRow from './SwipeRow.vue'

const ROW_WIDTH = 300

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(ROW_WIDTH)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function mountRow(onClick = vi.fn()) {
  const wrapper = mount(SwipeRow, {
    props: {
      leftAction: { label: 'Elimina', icon: 'trash', tone: 'danger' },
      rightAction: { label: 'Duplica', icon: 'copy', tone: 'pen' },
    },
    slots: {
      default: () => h('button', { class: 'content', onClick }, 'Riga'),
    },
    global: {
      plugins: testPlugins(),
    },
  })
  const root = wrapper.element as HTMLElement
  const pointer = (type: string, x: number, y = 100) =>
    root.dispatchEvent(new PointerEvent(type, {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: y,
      bubbles: true,
    }))
  return { wrapper, pointer }
}

describe('swipeRow', () => {
  it('triggers the action of the side past 40% of the width', async () => {
    const { wrapper, pointer } = mountRow()
    pointer('pointerdown', 280)
    pointer('pointermove', 240)
    pointer('pointermove', 100)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.swipe-row__action').classes()).toContain('swipe-row__action--danger')
    expect(wrapper.text()).toContain('Elimina')
    pointer('pointerup', 100)
    vi.advanceTimersByTime(200)
    expect(wrapper.emitted('swipe')).toEqual([
      ['left'],
    ])
  })

  it('goes back below the threshold', async () => {
    const { wrapper, pointer } = mountRow()
    pointer('pointerdown', 20)
    pointer('pointermove', 60)
    pointer('pointermove', 120)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Duplica')
    expect(wrapper.get('.swipe-row__action').classes()).not.toContain('swipe-row__action--pen')
    pointer('pointerup', 120)
    vi.advanceTimersByTime(200)
    expect(wrapper.emitted('swipe')).toBeUndefined()
  })

  it('leaves vertical gestures to the scroll', () => {
    const { wrapper, pointer } = mountRow()
    pointer('pointerdown', 200, 100)
    pointer('pointermove', 190, 160)
    pointer('pointermove', 20, 300)
    pointer('pointerup', 20, 300)
    vi.advanceTimersByTime(200)
    expect(wrapper.emitted('swipe')).toBeUndefined()
  })

  it('does not turn a swipe into a tap', async () => {
    const onClick = vi.fn()
    const { wrapper, pointer } = mountRow(onClick)
    pointer('pointerdown', 20)
    pointer('pointermove', 60)
    pointer('pointerup', 60)
    await wrapper.get('.content').trigger('click')
    expect(onClick).not.toHaveBeenCalled()
    await wrapper.get('.content').trigger('click')
    expect(onClick).toHaveBeenCalledOnce()
  })
})
