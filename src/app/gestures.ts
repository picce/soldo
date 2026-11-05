import type { MaybeRefOrGetter } from 'vue'
import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'
import { isIos, isStandalone } from '@/app/install'

/**
 * Gestures that close a sheet or go back a page (docs/specs/sensazione-nativa.md). The
 * dragged element follows the finger; on release it either completes the gesture or goes
 * back to its place.
 */

/** Share of the sheet or page a drag must pass to complete. */
export const CLOSE_SHARE = 0.25
/** A quick flick completes too: at least this speed, in px per ms, after this distance. */
export const FLICK_SPEED = 0.5
export const FLICK_DISTANCE = 24
/** Width of the left edge where a swipe back starts, in px. */
export const EDGE_WIDTH = 24
/** Movement before deciding whether a gesture is a drag or something else (a scroll, a tap). */
const SLOP = 8
/** The speed of a release is measured over the last moves of this window, in ms. */
const SPEED_WINDOW = 100

/** Whether a drag released `distance` px along a `size` px element completes the gesture. */
export function releaseCloses(distance: number, size: number, velocity: number): boolean {
  if (distance <= 0)
    return false
  return distance >= size * CLOSE_SHARE || (velocity >= FLICK_SPEED && distance >= FLICK_DISTANCE)
}

/** Speed of the last moves of a drag, in px per ms. */
function speedTracker() {
  let samples: { time: number, value: number }[] = []
  return {
    reset() {
      samples = []
    },
    add(value: number, time: number) {
      samples.push({ time, value })
      samples = samples.filter(sample => time - sample.time <= SPEED_WINDOW)
    },
    speed(): number {
      const first = samples[0]
      const last = samples.at(-1)
      if (!first || !last || last.time <= first.time)
        return 0
      return (last.value - first.value) / (last.time - first.time)
    },
  }
}

type Axis = 'x' | 'y'

interface DragOptions {
  /** Direction of the drag: down for a sheet, right for a page. */
  axis: Axis
  /** Whether a pointerdown may start the gesture (e.g. only at the left edge). */
  accepts?: (event: PointerEvent) => boolean
  /** Length of what is dragged along the axis: a quarter of it completes the gesture. */
  size: () => number
  onComplete: () => void
}

/**
 * A drag along one axis, forward only (down or right). `offset` follows the finger while
 * `dragging`; after a completed gesture it stays where the finger left it, so the element
 * can leave from there, until `reset()`.
 */
function useDrag(target: MaybeRefOrGetter<HTMLElement | null | undefined>, options: DragOptions) {
  const offset = ref(0)
  const dragging = ref(false)
  const tracker = speedTracker()
  let start: { id: number, x: number, y: number } | null = null
  let mode: 'undecided' | 'drag' | 'other' = 'undecided'

  useEventListener(target, 'pointerdown', (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0)
      return
    if ((event.target as Element | null)?.closest('button, a, input, textarea, select'))
      return
    if (options.accepts && !options.accepts(event))
      return
    start = { id: event.pointerId, x: event.clientX, y: event.clientY }
    mode = 'undecided'
    tracker.reset()
    tracker.add(0, event.timeStamp)
  })

  useEventListener(target, 'pointermove', (event: PointerEvent) => {
    if (!start || event.pointerId !== start.id || mode === 'other')
      return
    const along = options.axis === 'y'
      ? event.clientY - start.y
      : event.clientX - start.x
    const across = options.axis === 'y'
      ? event.clientX - start.x
      : event.clientY - start.y
    if (mode === 'undecided') {
      if (Math.abs(along) < SLOP && Math.abs(across) < SLOP)
        return
      if (Math.abs(across) >= Math.abs(along)) {
        mode = 'other'
        return
      }
      mode = 'drag'
      dragging.value = true
      ;(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
    }
    offset.value = Math.max(0, along)
    tracker.add(along, event.timeStamp)
  })

  function end(event: PointerEvent, cancelled: boolean) {
    if (!start || event.pointerId !== start.id)
      return
    const dragged = mode === 'drag'
    start = null
    mode = 'undecided'
    dragging.value = false
    if (!dragged)
      return
    if (!cancelled && releaseCloses(offset.value, options.size(), tracker.speed()))
      options.onComplete()
    else
      offset.value = 0
  }

  useEventListener(target, 'pointerup', (event: PointerEvent) => end(event, false))
  useEventListener(target, 'pointercancel', (event: PointerEvent) => end(event, true))

  return {
    offset,
    dragging,
    reset() {
      offset.value = 0
    },
  }
}

/**
 * Drag down to close (the head of a bottom sheet): past a quarter of `size()`, or with a
 * flick, `onClose` runs. Give the target `touch-action: none`.
 */
export function useDragToClose(target: MaybeRefOrGetter<HTMLElement | null | undefined>, size: () => number, onClose: () => void) {
  return useDrag(target, { axis: 'y', size, onComplete: onClose })
}

/** True where the system has no back gesture of its own: an installed app on iPhone. */
export function needsEdgeSwipe(): boolean {
  return isIos() && isStandalone()
}

/**
 * Swipe from the left edge to go back, where the system does not (`needsEdgeSwipe`):
 * the page follows the finger, and past a quarter of the screen, or with a flick,
 * `onBack` runs. Elsewhere the gesture belongs to the system and this does nothing.
 */
export function useEdgeSwipeBack(target: MaybeRefOrGetter<HTMLElement | null | undefined>, onBack: () => void, enabled = needsEdgeSwipe()) {
  return useDrag(enabled
    ? target
    : null, {
    axis: 'x',
    accepts: event => event.clientX <= EDGE_WIDTH,
    size: () => window.innerWidth,
    onComplete: onBack,
  })
}
