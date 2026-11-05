import type { RouteLocationRaw, Router } from 'vue-router'

/**
 * Back to the previous screen, like the system back button; when the screen was opened
 * directly (a link, a reload), there is nothing to go back to, so it goes to `fallback`.
 */
export function goBack(router: Router, fallback: RouteLocationRaw) {
  if (router.options.history.state.back)
    router.back()
  else
    void router.replace(fallback)
}
