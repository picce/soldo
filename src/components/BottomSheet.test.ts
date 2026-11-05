import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { testPlugins } from '@/test/plugins'
import BottomSheet from './BottomSheet.vue'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

async function mountSheet() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 400 } as DOMRect)
  const wrapper = mount(BottomSheet, {
    props: {
      'title': 'Data',
      'modelValue': true,
      'onUpdate:modelValue': (open: boolean) => wrapper.setProps({ modelValue: open }),
    },
    slots: {
      default: () => 'Contenuto',
    },
    attachTo: document.body,
    // The real Transition, which hands class and style over to the <dialog>.
    global: {
      plugins: testPlugins(),
      stubs: { transition: false },
    },
  })
  await nextTick()
  const head = wrapper.get('.bottom-sheet__head').element as HTMLElement
  let time = 0
  const pointer = (type: string, y: number, target: Element = head) => {
    const event = new PointerEvent(type, {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: 100,
      clientY: y,
      bubbles: true,
    })
    time += 200
    Object.defineProperty(event, 'timeStamp', { value: time })
    target.dispatchEvent(event)
  }
  const drag = () => (wrapper.get('dialog').element as HTMLElement).style.getPropertyValue('--sheet-drag')
  return { wrapper, pointer, drag }
}

describe('bottomSheet', () => {
  it('follows the finger when its head is dragged down, and closes past a quarter', async () => {
    const { wrapper, pointer, drag } = await mountSheet()
    pointer('pointerdown', 100)
    pointer('pointermove', 140)
    await nextTick()
    expect(drag()).toBe('40px')
    expect(wrapper.get('dialog').classes()).toContain('bottom-sheet--dragging')
    pointer('pointermove', 260)
    pointer('pointerup', 260)
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toEqual([
      [false],
    ])
    // It leaves from where the finger let it go.
    expect(drag()).toBe('160px')
  })

  it('goes back up after a short drag', async () => {
    const { wrapper, pointer, drag } = await mountSheet()
    pointer('pointerdown', 100)
    pointer('pointermove', 140)
    pointer('pointerup', 140)
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(drag()).toBe('0px')
  })

  it('keeps Chiudi a plain button, not the start of a drag', async () => {
    const { wrapper, pointer } = await mountSheet()
    const close = wrapper.get('.bottom-sheet__close')
    pointer('pointerdown', 100, close.element)
    pointer('pointermove', 300)
    pointer('pointerup', 300)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await close.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([
      [false],
    ])
  })
})
