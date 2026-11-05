import type { RouteLocationNormalized } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, START_LOCATION } from 'vue-router'
import { animatePageChanges, pageTransition } from './page-transitions'
import { createAppRouter } from './router'

function at(path: string): RouteLocationNormalized {
  return createAppRouter(createMemoryHistory()).resolve(path) as RouteLocationNormalized
}

describe('pageTransition', () => {
  it('fades between the sections of the navigation', () => {
    expect(pageTransition(at('/'), at('/movimenti'))).toBe('fade')
    expect(pageTransition(at('/impostazioni'), at('/'))).toBe('fade')
    expect(pageTransition(at('/benvenuto'), at('/'))).toBe('fade')
  })

  it('pushes into deeper pages and pops back up', () => {
    expect(pageTransition(at('/impostazioni'), at('/impostazioni/categorie'))).toBe('push')
    expect(pageTransition(at('/impostazioni/categorie'), at('/impostazioni/categorie/nuova'))).toBe('push')
    expect(pageTransition(at('/impostazioni/categorie/nuova'), at('/impostazioni/categorie'))).toBe('pop')
    expect(pageTransition(at('/impostazioni/categorie'), at('/impostazioni'))).toBe('pop')
  })

  it('raises the quick add and the edit of a transaction over the page, and lowers them', () => {
    expect(pageTransition(at('/'), at('/nuovo/uscita'))).toBe('modal-open')
    expect(pageTransition(at('/movimenti'), at('/movimenti/abc'))).toBe('modal-open')
    expect(pageTransition(at('/nuovo/entrata'), at('/'))).toBe('modal-close')
    expect(pageTransition(at('/movimenti/abc'), at('/movimenti'))).toBe('modal-close')
  })

  it('does not move on the first page, nor when only the query changes', () => {
    expect(pageTransition(START_LOCATION, at('/'))).toBeNull()
    expect(pageTransition(at('/movimenti'), at('/movimenti?tipo=uscite'))).toBeNull()
    expect(pageTransition(at('/impostazioni/categorie'), at('/impostazioni/categorie?tipo=entrate'))).toBeNull()
  })
})

describe('animatePageChanges', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(document, 'startViewTransition')
    delete document.documentElement.dataset.pageTransition
  })

  /** A browser with the View Transitions API: the update runs at once, the animation never ends. */
  function fakeViewTransitions() {
    const kinds: (string | undefined)[] = []
    const startViewTransition = vi.fn((update: () => Promise<void>) => {
      kinds.push(document.documentElement.dataset.pageTransition)
      const done = update()
      return {
        finished: new Promise(() => {}),
        updateCallbackDone: done,
      }
    })
    Object.defineProperty(document, 'startViewTransition', { value: startViewTransition, configurable: true })
    return { startViewTransition, kinds }
  }

  function reducedMotion(reduce: boolean) {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: reduce && query.includes('reduce') }) as MediaQueryList)
  }

  it('wraps a change of page in a view transition of the right kind', async () => {
    reducedMotion(false)
    const { startViewTransition, kinds } = fakeViewTransitions()
    const router = createAppRouter(createMemoryHistory())
    animatePageChanges(router)
    await router.push('/impostazioni')
    expect(startViewTransition).not.toHaveBeenCalled()

    await router.push('/impostazioni/categorie')
    expect(router.currentRoute.value.name).toBe('categories')
    expect(kinds).toEqual(['push'])

    await router.push('/nuovo/uscita')
    expect(kinds).toEqual([
      'push',
      'modal-open',
    ])
  })

  it('changes page at once with «Riduci movimento»', async () => {
    reducedMotion(true)
    const { startViewTransition } = fakeViewTransitions()
    const router = createAppRouter(createMemoryHistory())
    animatePageChanges(router)
    await router.push('/')
    await router.push('/movimenti')
    expect(router.currentRoute.value.name).toBe('transactions')
    expect(startViewTransition).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.pageTransition).toBeUndefined()
  })

  it('does nothing where the browser has no view transitions', async () => {
    reducedMotion(false)
    const router = createAppRouter(createMemoryHistory())
    animatePageChanges(router)
    await router.push('/')
    await router.push('/movimenti')
    expect(router.currentRoute.value.name).toBe('transactions')
    expect(document.documentElement.dataset.pageTransition).toBeUndefined()
  })
})
