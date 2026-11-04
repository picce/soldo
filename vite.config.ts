import { fileURLToPath, URL } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import vue from '@vitejs/plugin-vue'
import { VolverResolver } from '@volverjs/ui-vue/resolvers/unplugin'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    // Auto-import dei soli componenti Volver (Vv*). I componenti locali si importano esplicitamente.
    // Lo stile dei componenti è importato a mano in src/theme/volver.css, dentro i cascade layer.
    Components({
      dirs: [],
      dts: 'src/components.d.ts',
      resolvers: [
        VolverResolver({ importStyle: false }),
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
        background_color: '#ffffff',
        theme_color: '#166abd',
        categories: ['finance', 'productivity'],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
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
