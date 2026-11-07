import type { Ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import { computed } from 'vue'
import { niceStep } from '@/domain/stats'

/**
 * What LineChart and BarChart share (docs/specs/released/statistiche.md, "Grafici"): the size, the value
 * axis and reading a point with the finger, the mouse or the arrow keys.
 */

export const CHART_HEIGHT = 150
/** Room for the values of the axis on the left and the labels of the days or months below. */
export const CHART_PADDING = {
  top: 8,
  right: 8,
  bottom: 22,
  left: 44,
}

/** Width of the drawing in CSS pixels, so the text of the axes keeps its size on every screen. */
export function useChartWidth(element: Readonly<Ref<HTMLElement | null>>) {
  const { width } = useElementSize(element)
  return computed(() => Math.max(200, Math.round(width.value || 320)))
}

/** Value axis from zero: a round top above `max` and the ticks on the way, about three steps. */
export function valueAxis(max: number): { top: number, ticks: number[] } {
  const step = niceStep(max)
  const top = Math.max(step, Math.ceil(max / step) * step)
  return {
    top,
    ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step),
  }
}

interface SelectionOptions {
  count: () => number
  /** Index of the point under `x`, in pixels from the left of the drawing. */
  indexAt: (x: number) => number
  /** Where the arrow keys start when nothing is chosen. */
  start: () => number
}

/**
 * Choosing a point: a tap or a drag with the finger, or a click, and it stays chosen; the mouse
 * over the drawing reads a point until it leaves, while nothing was clicked; the arrow keys, Home
 * and End when the chart has the focus; Escape lets go. A click must stay: a link next to the
 * chart («Apri ottobre») is reached by leaving the drawing.
 */
export function useChartSelection(selected: Ref<number | null>, { count, indexAt, start }: SelectionOptions) {
  let pinned = false

  function pick(event: PointerEvent) {
    const box = (event.currentTarget as Element).getBoundingClientRect()
    const index = indexAt(event.clientX - box.left)
    selected.value = Math.min(count() - 1, Math.max(0, index))
  }

  function onPointerDown(event: PointerEvent) {
    pinned = true
    pick(event)
  }

  function onPointerMove(event: PointerEvent) {
    if (event.buttons > 0 || (event.pointerType === 'mouse' && !pinned))
      pick(event)
  }

  function onPointerLeave(event: PointerEvent) {
    if (event.pointerType === 'mouse' && !pinned)
      selected.value = null
  }

  function onKeydown(event: KeyboardEvent) {
    const last = count() - 1
    const from = selected.value ?? start()
    const next = {
      ArrowLeft: from - (selected.value === null
        ? 0
        : 1),
      ArrowRight: from + (selected.value === null
        ? 0
        : 1),
      Home: 0,
      End: last,
    }[event.key]
    if (event.key === 'Escape' && selected.value !== null) {
      pinned = false
      selected.value = null
      event.preventDefault()
      return
    }
    if (next === undefined)
      return
    event.preventDefault()
    selected.value = Math.min(last, Math.max(0, next))
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerLeave,
    onKeydown,
  }
}
