import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { forgetOnboarding, isOnboarded } from '@/app/onboarding'
import { createAppRouter } from '@/app/router'
import { db } from '@/db/database'
import { testPlugins } from '@/test/plugins'
import WelcomeView from './WelcomeView.vue'

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  forgetOnboarding()
})

async function mountWelcome() {
  const router = createAppRouter(createMemoryHistory())
  await router.push('/benvenuto')
  const wrapper = mount(WelcomeView, {
    global: {
      plugins: testPlugins(router),
    },
  })
  return { wrapper, router }
}

describe('welcomeView', () => {
  it('presents Soldo with a backup that is a file of yours', async () => {
    const { wrapper } = await mountWelcome()
    expect(wrapper.get('h1 .sr-only').text()).toBe('Soldo')
    expect(wrapper.text()).toContain('Il quaderno dei conti di casa.')
    expect(wrapper.text()).toContain('Il backup è un file tuo')
    expect(wrapper.text()).not.toContain('Drive')
  })

  it('starts from scratch once, even on a double tap, and opens the Home', async () => {
    const { wrapper, router } = await mountWelcome()
    const start = wrapper.findAll('button').find(button => button.text() === 'Inizia da zero')!
    await Promise.all([
      start.trigger('click'),
      start.trigger('click'),
    ])
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('home'), { timeout: 5000 })
    await flushPromises()

    expect(await db.categories.count()).toBe(16)
    expect(await db.accounts.count()).toBe(1)
    forgetOnboarding()
    expect(await isOnboarded()).toBe(true)
  })
})
