import {
  defineConfig,
  minimal2023Preset as preset,
} from '@vite-pwa/assets-generator/config'

// Icone provvisorie: verranno sostituite dal logo definitivo dello studio grafico (Fase 1).
const BRAND = '#166abd'

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...preset,
    maskable: {
      ...preset.maskable,
      resizeOptions: { background: BRAND },
    },
    apple: {
      ...preset.apple,
      resizeOptions: { background: BRAND },
    },
  },
  images: ['public/logo.svg'],
})
