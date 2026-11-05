import type { Ref } from 'vue'
import type { Category } from '@/db/schema'
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { showToast } from '@/app/toast'
import { reorderCategories } from '@/db/repositories/categories'
import { i18n } from '@/i18n'

/** Distance from the top and bottom of the screen where a dragged row scrolls the page. */
const SCROLL_EDGE = 64
/** The bottom edge starts above the bar of «Nuova categoria». */
const SCROLL_EDGE_BOTTOM = 140
const SCROLL_STEP = 8

interface DragSession {
  pointerId: number
  /** Index of the dragged row and the slot it would drop into. */
  index: number
  target: number
  startY: number
  lastClientY: number
  /** Vertical centers of the rows in page coordinates, and the dragged row's height. */
  centers: number[]
  height: number
  frame: number
}

/**
 * Order of a kind's categories (docs/specs/released/gestione-categorie.md): the dragged row follows
 * the finger, the others make room, and on release the whole order is saved; «Sposta su»
 * and «Sposta giù» do the same one step at a time. `items` follows the database, except
 * while a row is being dragged.
 */
export function useCategoryOrder(source: Ref<Category[] | undefined>) {
  const items = shallowRef<Category[]>([])
  /** Id of the dragged row. */
  const draggedId = ref<string | null>(null)
  /** Vertical shift of each row while dragging, in pixels. */
  const offsets = ref<Record<string, number>>({})
  /** True for the frame of a drop that changed the order: rows jump to their place. */
  const settling = ref(false)
  let session: DragSession | null = null

  watch(source, (rows) => {
    if (rows && !session)
      items.value = rows
  }, { immediate: true })

  function save(next: Category[]) {
    items.value = next
    reorderCategories(next.map(category => category.id)).catch(() => {
      items.value = source.value ?? []
      showToast({
        message: i18n.global.t('common.saveError'),
      })
    })
  }

  function moved(from: number, to: number): Category[] {
    const next = [...items.value]
    const [category] = next.splice(from, 1)
    next.splice(to, 0, category!)
    return next
  }

  /** Moves a row one step up (-1) or down (+1); false at the ends of the list. */
  function step(index: number, direction: -1 | 1): boolean {
    const target = index + direction
    if (target < 0 || target >= items.value.length)
      return false
    save(moved(index, target))
    return true
  }

  function layout() {
    if (!session)
      return
    const { index, centers, height } = session
    const first = centers[0]! - centers[index]!
    const last = centers.at(-1)! - centers[index]!
    const dy = Math.min(last, Math.max(first, session.lastClientY + window.scrollY - session.startY))
    const center = centers[index]! + dy
    let target = index
    centers.forEach((slot, slotIndex) => {
      if (Math.abs(slot - center) < Math.abs(centers[target]! - center))
        target = slotIndex
    })
    const next: Record<string, number> = {}
    items.value.forEach((category, row) => {
      if (row === index)
        next[category.id] = dy
      else if (index < row && row <= target)
        next[category.id] = -height
      else if (target <= row && row < index)
        next[category.id] = height
    })
    offsets.value = next
    if (target !== session.target && 'vibrate' in navigator)
      navigator.vibrate(10)
    session.target = target
  }

  function autoScroll() {
    if (!session)
      return
    const y = session.lastClientY
    const scroll = y < SCROLL_EDGE
      ? -SCROLL_STEP
      : y > window.innerHeight - SCROLL_EDGE_BOTTOM
        ? SCROLL_STEP
        : 0
    if (scroll) {
      window.scrollBy(0, scroll)
      layout()
    }
    session.frame = requestAnimationFrame(autoScroll)
  }

  /** pointerdown on a row's handle. */
  function startDrag(event: PointerEvent, index: number) {
    const handle = event.currentTarget as HTMLElement
    const list = handle.closest('li')?.parentElement
    if (session || event.button !== 0 || !list || !items.value[index])
      return
    event.preventDefault()
    handle.setPointerCapture(event.pointerId)
    const rects = [...list.children].map(row => row.getBoundingClientRect())
    session = {
      pointerId: event.pointerId,
      index,
      target: index,
      startY: event.clientY + window.scrollY,
      lastClientY: event.clientY,
      centers: rects.map(rect => rect.top + window.scrollY + rect.height / 2),
      height: rects[index]!.height,
      frame: requestAnimationFrame(autoScroll),
    }
    draggedId.value = items.value[index]!.id
  }

  /** pointermove on the handle: the pointer is captured, so moves arrive here. */
  function drag(event: PointerEvent) {
    if (session?.pointerId !== event.pointerId)
      return
    session.lastClientY = event.clientY
    layout()
  }

  /** pointerup (commit) or pointercancel on the handle. */
  function endDrag(event: PointerEvent, commit = true) {
    if (session?.pointerId !== event.pointerId)
      return
    const { index, target, frame } = session
    cancelAnimationFrame(frame)
    session = null
    const changed = commit && target !== index
    settling.value = changed
    offsets.value = {}
    draggedId.value = null
    if (changed)
      save(moved(index, target))
    else
      items.value = source.value ?? items.value
    requestAnimationFrame(() => requestAnimationFrame(() => {
      settling.value = false
    }))
  }

  onBeforeUnmount(() => {
    if (session)
      cancelAnimationFrame(session.frame)
    session = null
  })

  return {
    items,
    draggedId,
    offsets,
    settling,
    step,
    startDrag,
    drag,
    endDrag,
  }
}
