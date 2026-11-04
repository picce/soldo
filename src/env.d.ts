/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vue" />
/// <reference types="vite-plugin-pwa/info" />

import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** Chiave i18n del titolo della pagina, usata per `document.title`. */
    titleKey?: string
  }
}
