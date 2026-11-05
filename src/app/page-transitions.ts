import type { RouteLocationNormalized, Router } from 'vue-router'
import { nextTick } from 'vue'
import { prefersReducedMotion } from '@/app/motion'
import { scrollRestored } from '@/app/scroll'

/**
 * How a page gives way to the next (docs/specs/released/sensazione-nativa.md); the animations are
 * in src/theme/motion.css, keyed on `data-page-transition` of <html>.
 */
export type PageTransition = 'fade' | 'push' | 'pop' | 'modal-open' | 'modal-close'

/** Longest wait for the new page to be drawn: past it, the transition goes on anyway. */
const DRAW_WAIT = 1000

/**
 * The transition between two pages, from their `meta`: into and out of a `modal` page it
 * rises and falls; towards a deeper page it pushes, back up it pops; between pages of the
 * same level it fades. Nothing moves on the first page and when only the query changes
 * (the filters of Movimenti, the kind of Categorie).
 */
export function pageTransition(from: RouteLocationNormalized, to: RouteLocationNormalized): PageTransition | null {
  if (!from.matched.length || from.path === to.path)
    return null
  const fromModal = from.meta.modal === true
  const toModal = to.meta.modal === true
  if (toModal !== fromModal) {
    return toModal
      ? 'modal-open'
      : 'modal-close'
  }
  const fromDepth = from.meta.depth ?? 0
  const toDepth = to.meta.depth ?? 0
  if (toDepth === fromDepth)
    return 'fade'
  return toDepth > fromDepth
    ? 'push'
    : 'pop'
}

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

/**
 * Animates every change of page with the View Transitions API, where the browser has it;
 * elsewhere, and with «Riduci movimento», pages change at once. The browser shows the old
 * page as a still image until the new one is drawn and scrolled into place, then
 * motion.css moves the two images. Installed by main.ts, so page tests do not go through it.
 */
export function animatePageChanges(router: Router) {
  if (typeof document === 'undefined' || !('startViewTransition' in document))
    return

  // A back swipe the system has already animated (Safari, Chrome) must not slide a second
  // time; browsers without the property leave it undefined.
  let systemAnimated = false
  window.addEventListener('popstate', (event) => {
    systemAnimated = event.hasUAVisualTransition === true
  })

  let count = 0
  router.beforeResolve((to, from) => {
    const kind = pageTransition(from, to)
    const skip = systemAnimated || prefersReducedMotion()
    systemAnimated = false
    if (!kind || skip)
      return true

    return new Promise<true>((proceed) => {
      const id = ++count
      const root = document.documentElement
      root.dataset.pageTransition = kind
      const transition = document.startViewTransition(async () => {
        const drawn = new Promise<void>((done) => {
          const stop = router.afterEach(() => {
            stop()
            void nextTick(done)
          })
        })
        proceed(true)
        await Promise.race([
          drawn.then(scrollRestored),
          delay(DRAW_WAIT),
        ])
      })
      const clear = () => {
        if (id === count)
          delete root.dataset.pageTransition
      }
      transition.finished.then(clear, clear)
    })
  })
}
