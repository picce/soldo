import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { VolverResolver } from '@volverjs/ui-vue/resolvers/unplugin'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    vue(),
    Components({
      dirs: [],
      dts: false,
      resolvers: [
        VolverResolver({ importStyle: false }),
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
