import {
  defineConfig,
  minimal2023Preset as preset,
} from '@vite-pwa/assets-generator/config'

// public/logo.svg is the full-bleed "A · Quaderno" icon (docs/design/README.md, "Identità").
// Its mark already sits inside the maskable safe zone, so no variant adds padding.
export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...preset,
    transparent: {
      ...preset.transparent,
      padding: 0,
    },
    maskable: {
      ...preset.maskable,
      padding: 0,
    },
    apple: {
      ...preset.apple,
      padding: 0,
    },
  },
  images: ['public/logo.svg'],
})
