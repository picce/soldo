import type { Ref } from 'vue'
import { getCurrentScope, onScopeDispose, readonly, ref, watch } from 'vue'

/** Pixels left to scroll below which the end counts as reached: rounding and borders. */
const SLACK = 4

/**
 * True while content of `element` is still hidden below: a list cut off by what is under it (the
 * categories above the keypad of the quick add) fades out at the bottom, so it shows there is
 * more. Its bottom padding does not count, or a last row in full view would fade too. It follows
 * scrolling and changes of size, of the element and of its content.
 */
export function useMoreBelow(element: Readonly<Ref<HTMLElement | null | undefined>>): Readonly<Ref<boolean>> {
  const more = ref(false)
  let resizes: ResizeObserver | undefined
  let current: HTMLElement | undefined

  function update() {
    if (!current) {
      more.value = false
      return
    }
    const padding = Number.parseFloat(getComputedStyle(current).paddingBottom) || 0
    more.value = current.scrollHeight - current.clientHeight - current.scrollTop - padding > SLACK
  }

  function detach() {
    current?.removeEventListener('scroll', update)
    resizes?.disconnect()
    current = undefined
  }

  watch(element, (target) => {
    detach()
    if (target) {
      current = target
      target.addEventListener('scroll', update, { passive: true })
      if (typeof ResizeObserver !== 'undefined') {
        resizes = new ResizeObserver(update)
        resizes.observe(target)
        for (const child of target.children)
          resizes.observe(child)
      }
    }
    update()
  }, { immediate: true, flush: 'post' })

  if (getCurrentScope())
    onScopeDispose(detach)

  return readonly(more)
}
