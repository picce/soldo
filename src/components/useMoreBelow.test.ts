import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, useTemplateRef } from 'vue'
import { useMoreBelow } from './useMoreBelow'

/** happy-dom has no layout: the sizes of the list are set by hand. */
function size(element: HTMLElement, sizes: { scrollHeight: number, clientHeight: number, scrollTop?: number }) {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: sizes.scrollHeight })
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: sizes.clientHeight })
  element.scrollTop = sizes.scrollTop ?? 0
}

const List = defineComponent({
  setup(_, { expose }) {
    const more = useMoreBelow(useTemplateRef<HTMLElement>('list'))
    expose({ more })
    return () => h('div', { ref: 'list', style: 'padding-bottom: 16px' }, [
      h('p', 'rows'),
    ])
  },
})

describe('useMoreBelow', () => {
  it('says when part of the list is hidden below, until it is scrolled to the end', async () => {
    const wrapper = mount(List, { attachTo: document.body })
    const list = wrapper.element as HTMLElement
    const more = () => (wrapper.vm as unknown as { more: boolean }).more

    size(list, { scrollHeight: 400, clientHeight: 300 })
    list.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(more()).toBe(true)

    size(list, { scrollHeight: 400, clientHeight: 300, scrollTop: 100 })
    list.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(more()).toBe(false)
    wrapper.unmount()
  })

  it('does not count the bottom padding: a last row in full view does not fade', async () => {
    const wrapper = mount(List, { attachTo: document.body })
    const list = wrapper.element as HTMLElement
    size(list, { scrollHeight: 316, clientHeight: 300 })
    list.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect((wrapper.vm as unknown as { more: boolean }).more).toBe(false)
    wrapper.unmount()
  })
})
