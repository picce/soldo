import { VolverPlugin } from '@volverjs/ui-vue'
// Solo la collezione "normal" (le altre due pesano ~230 kB in più): il set di icone
// definitivo verrà scelto con lo studio grafico (Fase 1).
import normalIcons from '@volverjs/ui-vue/src/assets/icons/normal.json'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createAppRouter } from '@/app/router'
import { i18n } from '@/i18n'
import App from './App.vue'
import '@/theme/volver.css'
import '@/theme/app.css'

const app = createApp(App)

app
  .use(createPinia())
  .use(createAppRouter())
  .use(i18n)
  .use(VolverPlugin, {
    iconsCollections: [normalIcons],
  })

app.mount('#app')
