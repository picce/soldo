import { VolverPlugin } from '@volverjs/ui-vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import phIcons from '@/assets/icons/ph.json'
import AppIcon from '@/components/AppIcon.vue'
import { i18n } from '@/i18n'
import { applyLocale } from '@/i18n/locale'
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
            iconsCollections: [phIcons],
          },
        ],
      ],
    },
  })
}

afterEach(() => applyLocale('it'))

describe('bottomNav', () => {
  it('shows the five main sections', async () => {
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

  it('puts the pen mark on the current section, and none on other pages', async () => {
    const stats = await mountAt('/statistiche')
    const mark = stats.get('.bottom-nav__indicator')
    expect((mark.element as HTMLElement).style.getPropertyValue('--nav-index')).toBe('3')
    expect(mark.attributes('aria-hidden')).toBe('true')

    const categories = await mountAt('/impostazioni/categorie')
    expect(categories.find('.bottom-nav__indicator').exists()).toBe(false)
  })

  it('marks the active section as current, with the Regular icon', async () => {
    const wrapper = await mountAt('/statistiche')
    const current = wrapper.findAll('a').filter(link => link.attributes('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current[0]?.text()).toBe('Statistiche')
    const weights = wrapper.findAllComponents(AppIcon).map(icon => icon.props('weight'))
    expect(weights).toEqual([
      'light',
      'light',
      'light',
      'regular',
      'light',
    ])
  })

  it('follows the app language', async () => {
    applyLocale('en')
    const wrapper = await mountAt('/')
    const labels = wrapper.findAll('a').map(link => link.text())
    expect(labels).toEqual([
      'Home',
      'Transactions',
      'Budget',
      'Statistics',
      'Settings',
    ])
    expect(wrapper.get('nav').attributes('aria-label')).toBe('Main navigation')
  })
})
