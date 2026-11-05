import type { RouterScrollBehavior } from 'vue-router'

/** Longest wait for a page to grow tall enough to restore its scroll, in milliseconds. */
export const SCROLL_WAIT = 500

let restoring: Promise<void> = Promise.resolve()

/**
 * Resolves once the page is tall enough to scroll down to `top`, or after `timeout`: the
 * rows of a list come from IndexedDB a moment after the page is drawn.
 */
export function whenScrollable(top: number, timeout = SCROLL_WAIT): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now()
    function check() {
      const room = document.documentElement.scrollHeight - window.innerHeight
      if (room >= top || performance.now() - start >= timeout)
        resolve()
      else
        requestAnimationFrame(check)
    }
    check()
  })
}

/**
 * Scroll of the router: back to a page, the position it had (Movimenti returns to the row
 * that was opened); a new page starts from the top.
 */
export const restoreScroll: RouterScrollBehavior = (_to, _from, saved) => {
  if (!saved) {
    restoring = Promise.resolve()
    return { top: 0 }
  }
  restoring = whenScrollable(saved.top)
  return restoring.then(() => saved)
}

/** Settles when the last navigation has its scroll back: page transitions wait for it. */
export function scrollRestored(): Promise<void> {
  return restoring
}
