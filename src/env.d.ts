/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vue" />
/// <reference types="vite-plugin-pwa/info" />

import 'vue-router'

declare global {
  /** App version from package.json, fixed at build time (build-info.ts). */
  const __APP_VERSION__: string
  /** Short commit the app was built from; empty when unknown. */
  const __APP_COMMIT__: string
}

declare module 'vue-router' {
  interface RouteMeta {
    /** i18n key of the page title, used for `document.title`. */
    titleKey?: string
  }
}
