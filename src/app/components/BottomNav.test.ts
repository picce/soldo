import { VolverPlugin } from '@volverjs/ui-vue'
import normalIcons from '@volverjs/ui-vue/src/assets/icons/normal.json'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { i18n } from '@/i18n'
import BottomNav from './BottomNav.vue'

async function mountAt(path: string) {
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  return mount(BottomNav, {
    global: {
      plugins: [
        router,
        i18n,
        [
          VolverPlugin,
          {
            iconsCollections: [normalIcons],
          },
        ],
      ],
    },
  })
}

describe('bottomNav', () => {
  it('mostra le cinque sezioni principali', async () => {
    const wrapper = await mountAt('/')
    const labels = wrapper.findAll('a').map(link => link.text())
    expect(labels).toEqual([
      'Home',
      'Movimenti',
      'Budget',
      'Statistiche',
      'Impostazioni',
    ])
    expect(wrapper.get('nav').attributes('aria-label')).toBe('Navigazione principale')
  })

  it('segna come corrente la sezione attiva', async () => {
    const wrapper = await mountAt('/statistiche')
    const current = wrapper.findAll('a').filter(link => link.attributes('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current[0]?.text()).toBe('Statistiche')
  })
})
