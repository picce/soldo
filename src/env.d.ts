/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vue" />
/// <reference types="vite-plugin-pwa/info" />

import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** i18n key of the page title, used for `document.title`. */
    titleKey?: string
  }
}
