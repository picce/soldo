import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { forgetOnboarding, isOnboarded } from '@/app/onboarding'
import { createAppRouter } from '@/app/router'
import { resetGoogleAuth } from '@/backup/google/auth'
import { patchBackupState, resetBackupState } from '@/backup/state'
import { db } from '@/db/database'
import { createFakeDrive, fakeDriveFetch } from '@/test/fake-drive'
import { testPlugins } from '@/test/plugins'
import WelcomeView from './WelcomeView.vue'

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  forgetOnboarding()
  resetGoogleAuth()
  resetBackupState()
})

async function mountWelcome(path = '/benvenuto') {
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  const wrapper = mount(WelcomeView, {
    global: {
      plugins: testPlugins(router),
      // VvDialog opens its <dialog> when its transition runs: the default stub never does.
      stubs: { transition: false },
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
    // The Home is a lazy page: its first import can take seconds when every file runs at once.
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('home'), { timeout: 10_000 })
    await flushPromises()

    expect(await db.categories.count()).toBe(16)
    expect(await db.accounts.count()).toBe(1)
    forgetOnboarding()
    expect(await isOnboarded()).toBe(true)
  })

  it('offers Google Drive first where the site can reach it, a file as the third way', async () => {
    vi.stubGlobal('fetch', fakeDriveFetch(createFakeDrive()))
    const { wrapper } = await mountWelcome()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Il backup va sul tuo Drive'))
    expect(wrapper.get('.welcome__actions').findAll('button').map(button => button.text())).toEqual([
      'Inizia da zero',
      'Ripristina da Google Drive',
      'Ripristina da un file',
    ])
  })

  it('opens the backups on Drive when it comes back from Google', async () => {
    const drive = createFakeDrive()
    vi.stubGlobal('fetch', fakeDriveFetch(drive))
    const { wrapper, router } = await mountWelcome('/benvenuto?ripristina=drive')
    // The address loses the request, and the list waits for the connection.
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/benvenuto'))
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
    patchBackupState({ connected: true })
    await vi.waitFor(() => expect(wrapper.get('dialog[open]').text()).toContain('Su questo Google Drive non ci sono backup di Soldo.'))
  })
})
