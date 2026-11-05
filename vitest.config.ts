import { fileURLToPath, URL } from 'node:url'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import vue from '@vitejs/plugin-vue'
import { VolverResolver } from '@volverjs/ui-vue/resolvers/unplugin'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vitest/config'
import { appDefines } from './build-info'

export default defineConfig({
  define: appDefines(),
  plugins: [
    vue(),
    VueI18nPlugin({
      include: fileURLToPath(new URL('./src/i18n/locales/**', import.meta.url)),
    }),
    Components({
      dirs: [],
      dts: false,
      resolvers: [
        VolverResolver({ importStyle: false, cherryPick: true }),
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
    setupFiles: ['fake-indexeddb/auto'],
  },
})
