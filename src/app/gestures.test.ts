import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { releaseCloses, useDragToClose, useEdgeSwipeBack } from './gestures'

describe('releaseCloses', () => {
  it('completes past a quarter of the size', () => {
    expect(releaseCloses(100, 400, 0)).toBe(true)
    expect(releaseCloses(99, 400, 0)).toBe(false)
  })

  it('completes a quick flick, but not a twitch', () => {
    expect(releaseCloses(30, 400, 0.8)).toBe(true)
    expect(releaseCloses(10, 400, 2)).toBe(false)
  })

  it('never completes backwards', () => {
    expect(releaseCloses(0, 400, 1)).toBe(false)
    expect(releaseCloses(-200, 400, 1)).toBe(false)
  })
})

/** Pointer events on an element, with explicit times for the speed of the release. */
function pointerOn(element: HTMLElement) {
  return (type: string, x: number, y: number, time: number) => {
    const event = new PointerEvent(type, {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: y,
      bubbles: true,
    })
    Object.defineProperty(event, 'timeStamp', { value: time })
    element.dispatchEvent(event)
  }
}

async function setUp<T>(use: (element: HTMLElement, onDone: () => void) => T) {
  const element = document.createElement('div')
  document.body.append(element)
  const onDone = vi.fn()
  const scope = effectScope()
  const result = scope.run(() => use(element, onDone))!
  await nextTick()
  return {
    element,
    onDone,
    result,
    pointer: pointerOn(element),
    stop: () => scope.stop(),
  }
}

describe('useDragToClose', () => {
  const SHEET = 400

  it('follows the finger down and closes past a quarter of the sheet', async () => {
    const { onDone, result, pointer, stop } = await setUp((element, onClose) => useDragToClose(ref(element), () => SHEET, onClose))
    pointer('pointerdown', 100, 50, 0)
    pointer('pointermove', 102, 70, 100)
    expect(result.dragging.value).toBe(true)
    expect(result.offset.value).toBe(20)
    pointer('pointermove', 102, 170, 400)
    pointer('pointerup', 102, 170, 800)
    expect(onDone).toHaveBeenCalledOnce()
    // The sheet leaves from where the finger let it go.
    expect(result.offset.value).toBe(120)
    result.reset()
    expect(result.offset.value).toBe(0)
    stop()
  })

  it('closes with a flick, and goes back after a slow short drag', async () => {
    const flick = await setUp((element, onClose) => useDragToClose(ref(element), () => SHEET, onClose))
    flick.pointer('pointerdown', 100, 50, 0)
    flick.pointer('pointermove', 100, 70, 20)
    flick.pointer('pointermove', 100, 110, 60)
    flick.pointer('pointerup', 100, 110, 70)
    expect(flick.onDone).toHaveBeenCalledOnce()
    flick.stop()

    const slow = await setUp((element, onClose) => useDragToClose(ref(element), () => SHEET, onClose))
    slow.pointer('pointerdown', 100, 50, 0)
    slow.pointer('pointermove', 100, 70, 300)
    slow.pointer('pointermove', 100, 110, 900)
    slow.pointer('pointerup', 100, 110, 1500)
    expect(slow.onDone).not.toHaveBeenCalled()
    expect(slow.result.offset.value).toBe(0)
    slow.stop()
  })

  it('does not move up, sideways, or from a button', async () => {
    const { element, onDone, result, pointer, stop } = await setUp((target, onClose) => useDragToClose(ref(target), () => SHEET, onClose))
    pointer('pointerdown', 100, 200, 0)
    pointer('pointermove', 100, 100, 100)
    expect(result.offset.value).toBe(0)
    pointer('pointerup', 100, 100, 200)

    pointer('pointerdown', 100, 50, 300)
    pointer('pointermove', 200, 80, 400)
    pointer('pointermove', 300, 300, 500)
    pointer('pointerup', 300, 300, 600)
    expect(result.offset.value).toBe(0)

    const button = document.createElement('button')
    element.append(button)
    pointerOn(button)('pointerdown', 100, 50, 700)
    pointer('pointermove', 100, 300, 800)
    pointer('pointerup', 100, 300, 900)
    expect(onDone).not.toHaveBeenCalled()
    stop()
  })

  it('goes back when the system takes the gesture', async () => {
    const { onDone, result, pointer, stop } = await setUp((element, onClose) => useDragToClose(ref(element), () => SHEET, onClose))
    pointer('pointerdown', 100, 50, 0)
    pointer('pointermove', 100, 300, 100)
    pointer('pointercancel', 100, 300, 200)
    expect(onDone).not.toHaveBeenCalled()
    expect(result.offset.value).toBe(0)
    stop()
  })
})

describe('useEdgeSwipeBack', () => {
  it('goes back with a swipe from the left edge', async () => {
    const { onDone, result, pointer, stop } = await setUp((element, onBack) => useEdgeSwipeBack(ref(element), onBack, true))
    pointer('pointerdown', 10, 300, 0)
    pointer('pointermove', 40, 302, 100)
    expect(result.offset.value).toBe(30)
    pointer('pointermove', 300, 310, 500)
    pointer('pointerup', 300, 310, 900)
    expect(onDone).toHaveBeenCalledOnce()
    stop()
  })

  it('ignores swipes that start away from the edge', async () => {
    const { onDone, result, pointer, stop } = await setUp((element, onBack) => useEdgeSwipeBack(ref(element), onBack, true))
    pointer('pointerdown', 120, 300, 0)
    pointer('pointermove', 400, 300, 100)
    pointer('pointerup', 400, 300, 200)
    expect(result.offset.value).toBe(0)
    expect(onDone).not.toHaveBeenCalled()
    stop()
  })

  it('leaves the gesture to the system where it has one', async () => {
    const { onDone, result, pointer, stop } = await setUp((element, onBack) => useEdgeSwipeBack(ref(element), onBack, false))
    pointer('pointerdown', 10, 300, 0)
    pointer('pointermove', 300, 300, 100)
    pointer('pointerup', 300, 300, 200)
    expect(result.offset.value).toBe(0)
    expect(onDone).not.toHaveBeenCalled()
    stop()
  })
})
