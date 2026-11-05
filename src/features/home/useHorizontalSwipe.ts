import type { Ref } from 'vue'
import { useEventListener } from '@vueuse/core'

/** Minimum horizontal travel of a swipe, in CSS pixels (docs/specs/home-rendiconto.md). */
export const SWIPE_THRESHOLD = 60

/**
 * Calls `onSwipe` when a finger (or the mouse) moves sideways over `target` by at least
 * 60 px, and more than it moves vertically: −1 for a swipe to the right (back in time),
 * 1 for a swipe to the left. Give the target `touch-action: pan-y`, so the browser keeps
 * the vertical scroll and leaves the horizontal moves to the page.
 */
export function useHorizontalSwipe(target: Ref<HTMLElement | null | undefined>, onSwipe: (step: -1 | 1) => void) {
  let start: { id: number, x: number, y: number } | null = null

  useEventListener(target, 'pointerdown', (event: PointerEvent) => {
    if (event.isPrimary && event.button === 0)
      start = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }, { passive: true })

  useEventListener(target, 'pointerup', (event: PointerEvent) => {
    if (!start || event.pointerId !== start.id)
      return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    start = null
    if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      onSwipe(dx < 0
        ? 1
        : -1)
    }
  }, { passive: true })

  useEventListener(target, 'pointercancel', () => {
    start = null
  }, { passive: true })
}
