import { fileURLToPath, URL } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import vue from '@vitejs/plugin-vue'
import { VolverResolver } from '@volverjs/ui-vue/resolvers/unplugin'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { appDefines } from './build-info'

export default defineConfig({
  define: appDefines(),
  plugins: [
    vue(),
    // Precompiles the messages in src/i18n/locales and aliases vue-i18n to its runtime build
    // (no message compiler in the bundle).
    VueI18nPlugin({
      include: fileURLToPath(new URL('./src/i18n/locales/**', import.meta.url)),
    }),
    // Auto-imports Volver components (Vv*) only. Local components are imported explicitly.
    // Component styles are imported by hand in src/theme/volver.css, inside cascade layers.
    Components({
      dirs: [],
      dts: 'src/components.d.ts',
      resolvers: [
        VolverResolver({ importStyle: false, cherryPick: true }),
      ],
    }),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      pwaAssets: {
        config: true,
        overrideManifestIcons: true,
      },
      manifest: {
        id: '/',
        name: 'Soldo',
        short_name: 'Soldo',
        description: 'Le tue spese quotidiane, anche offline.',
        lang: 'it',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        // Paper color of the Taccuino theme (docs/design/README.md).
        background_color: '#f5f4ef',
        theme_color: '#f5f4ef',
        categories: ['finance', 'productivity'],
        // Long press on the app icon (docs/specs/released/aggiunta-rapida.md).
        shortcuts: [
          {
            name: 'Nuova uscita',
            short_name: 'Uscita',
            url: '/nuovo/uscita',
            icons: [
              { src: '/shortcut-expense.png', sizes: '192x192', type: 'image/png' },
            ],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        // The API, and the privacy page: a static page outside the app.
        navigateFallbackDenylist: [/^\/api\//, /^\/privacy/],
        cleanupOutdatedCaches: true,
      },
    }),
    cloudflare(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
