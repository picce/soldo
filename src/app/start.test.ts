import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from './router'
import { openOnStart, reloadStartPage, setStartPage, START_KEY, startPage } from './start'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  reloadStartPage()
})

function startedRouter() {
  const router = createAppRouter(createMemoryHistory())
  openOnStart(router)
  return router
}

describe('start page', () => {
  it('is the Home until the preference says otherwise, and is remembered', () => {
    expect(startPage.value).toBe('home')
    setStartPage('expense')
    expect(localStorage.getItem(START_KEY)).toBe('expense')
    reloadStartPage()
    expect(startPage.value).toBe('expense')
    setStartPage('home')
    expect(localStorage.getItem(START_KEY)).toBeNull()
  })

  it('opens on the Home by default', async () => {
    const router = startedRouter()
    await router.push('/')
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('opens on the new expense when asked, with the Home one step away', async () => {
    setStartPage('expense')
    const router = startedRouter()
    await router.push('/')
    expect(router.currentRoute.value).toMatchObject({
      name: 'transaction-new',
      params: { kind: 'uscita' },
    })
    // Closing or saving goes to the Home, which stays the Home from then on.
    await router.replace('/')
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('respects any other address the app is opened at', async () => {
    setStartPage('expense')
    const router = startedRouter()
    await router.push('/movimenti')
    expect(router.currentRoute.value.name).toBe('transactions')
    await router.push('/')
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('does not open the keypad again on a reload in the same tab', async () => {
    setStartPage('expense')
    await startedRouter().push('/')
    // The page reloads: a new router, the same sessionStorage.
    const reloaded = startedRouter()
    await reloaded.push('/')
    expect(reloaded.currentRoute.value.name).toBe('home')
  })
})
