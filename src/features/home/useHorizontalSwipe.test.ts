import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useHorizontalSwipe } from './useHorizontalSwipe'

async function swipe(dx: number, dy: number) {
  const element = document.createElement('div')
  const onSwipe = vi.fn()
  const scope = effectScope()
  scope.run(() => useHorizontalSwipe(ref(element), onSwipe))
  await nextTick()
  const at = (type: string, x: number, y: number) =>
    element.dispatchEvent(new PointerEvent(type, {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: y,
    }))
  at('pointerdown', 200, 300)
  at('pointerup', 200 + dx, 300 + dy)
  scope.stop()
  return onSwipe
}

describe('useHorizontalSwipe', () => {
  it('goes forward on a swipe to the left and back on a swipe to the right', async () => {
    expect(await swipe(-80, 10)).toHaveBeenCalledWith(1)
    expect(await swipe(80, -10)).toHaveBeenCalledWith(-1)
  })

  it('ignores short and mostly vertical moves', async () => {
    expect(await swipe(-40, 0)).not.toHaveBeenCalled()
    expect(await swipe(-70, 90)).not.toHaveBeenCalled()
  })
})
