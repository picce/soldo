import type { Ref } from 'vue'
import { getCurrentScope, onScopeDispose, readonly, ref, watch } from 'vue'
import { prefersReducedMotion } from '@/app/motion'

/** Duration of a change, as --motion-base in tokens.css. */
export const TWEEN_DURATION = 200

/** Fast start, soft landing: close to --motion-ease. */
function easeOut(progress: number): number {
  return 1 - (1 - progress) ** 3
}

/**
 * A number that, when `source` changes, runs from the old value to the new one in
 * `TWEEN_DURATION` (the figures of the Home, docs/design/README.md "Movimento"). The first
 * value shows at once, and so does every change while `enabled` is false or the system
 * asks for less motion.
 */
export function useTweenedNumber(source: () => number, enabled: () => boolean = () => true): Readonly<Ref<number>> {
  const value = ref(source())
  let frame = 0

  watch(source, (target) => {
    cancelAnimationFrame(frame)
    if (!enabled() || prefersReducedMotion()) {
      value.value = target
      return
    }
    const from = value.value
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / TWEEN_DURATION))
      if (progress < 1) {
        value.value = from + (target - from) * easeOut(progress)
        frame = requestAnimationFrame(step)
      }
      else {
        value.value = target
      }
    }
    frame = requestAnimationFrame(step)
  })

  if (getCurrentScope())
    onScopeDispose(() => cancelAnimationFrame(frame))

  return readonly(value)
}
