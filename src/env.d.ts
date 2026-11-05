/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vue" />
/// <reference types="vite-plugin-pwa/info" />

import type { RouteLocationNormalized } from 'vue-router'
import 'vue-router'

declare global {
  /** App version from package.json, fixed at build time (build-info.ts). */
  const __APP_VERSION__: string
  /** Short commit the app was built from; empty when unknown. */
  const __APP_COMMIT__: string
}

declare module 'vue-router' {
  interface RouteMeta {
    /** i18n key of the page title, used for `document.title`; a function when it depends on the route. */
    titleKey?: string | ((route: RouteLocationNormalized) => string)
    /** Full-screen page (the transaction editor): no bottom navigation. */
    fullscreen?: boolean
    /**
     * Level of the page, which picks the page transition (src/app/page-transitions.ts):
     * 0 for the sections of the navigation (the default), 1 for a page opened from one of
     * them, 2 for a page opened from that one.
     */
    depth?: number
    /** Page that opens over the others, from the bottom: quick add and transaction edit. */
    modal?: boolean
  }
}
