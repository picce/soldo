import { VolverPlugin } from '@volverjs/ui-vue'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { listenForInstall } from '@/app/install'
import { createAppRouter, requireOnboarding } from '@/app/router'
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

// The browser may offer installation before the welcome page is shown.
listenForInstall()

// Until the first start is done, every page leads to the welcome (docs/specs/released/onboarding.md).
const router = createAppRouter()
requireOnboarding(router)

const app = createApp(App)

app
  .use(createPinia())
  .use(router)
  .use(i18n)
  .use(VolverPlugin, {
    iconsCollections: [phIcons],
  })

app.mount('#app')
