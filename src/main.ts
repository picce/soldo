import { VolverPlugin } from '@volverjs/ui-vue'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createAppRouter } from '@/app/router'
// Only the Phosphor icons the app uses (scripts/build-icons.js): nothing is fetched at runtime.
import phIcons from '@/assets/icons/ph.json'
import { i18n } from '@/i18n'
import { initLocale } from '@/i18n/locale'
import App from './App.vue'
import '@/theme/fonts.css'
import '@/theme/volver.css'
import '@/theme/tokens.css'
import '@/theme/app.css'

// Before mounting, so the first render is already in the right language.
initLocale()

// Default categories and the "Contanti" account, once. The onboarding
// (docs/specs/onboarding.md) will take this over with «Inizia da zero».
// Imported lazily: the database code stays out of the first chunk.
void import('@/db/seed').then(({ seedDefaults }) => seedDefaults())

const app = createApp(App)

app
  .use(createPinia())
  .use(createAppRouter())
  .use(i18n)
  .use(VolverPlugin, {
    iconsCollections: [phIcons],
  })

app.mount('#app')
