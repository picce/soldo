import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { applyLocale } from '@/i18n/locale'
import { createAppRouter } from './router'

afterEach(() => applyLocale('it'))

describe('router', () => {
  it.each([
    ['/', 'home'],
    ['/movimenti', 'transactions'],
    ['/budget', 'budget'],
    ['/statistiche', 'stats'],
    ['/impostazioni', 'settings'],
    ['/nuovo/uscita', 'transaction-new'],
    ['/nuovo/entrata', 'transaction-new'],
    ['/movimenti/abc', 'transaction-edit'],
    ['/impostazioni/categorie', 'categories'],
    ['/impostazioni/categorie/nuova', 'category-edit'],
    ['/impostazioni/categorie/abc', 'category-edit'],
  ])('resolves %s to the %s route', (path, name) => {
    const router = createAppRouter(createMemoryHistory())
    expect(router.resolve(path).name).toBe(name)
  })

  it('redirects unknown routes to home', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/non-esiste')
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('updates the document title', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/movimenti')
    expect(document.title).toBe('Movimenti · Soldo')
    await router.push('/')
    expect(document.title).toBe('Soldo')
  })

  it('names the editor after the kind of transaction', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/nuovo/entrata')
    expect(document.title).toBe('Nuova entrata · Soldo')
    expect(router.currentRoute.value.meta.fullscreen).toBe(true)
    await router.push('/nuovo/uscita')
    expect(document.title).toBe('Nuova uscita · Soldo')
    await router.push('/nuovo/altro')
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('opens a new category of the kind in the URL, or an existing one', async () => {
    const router = createAppRouter(createMemoryHistory())
    const props = (path: string) => {
      const route = router.resolve(path)
      const resolve = route.matched[0]!.props.default as (r: typeof route) => unknown
      return resolve(route)
    }
    expect(props('/impostazioni/categorie/nuova?tipo=entrate')).toEqual({ id: null, kind: 'income' })
    expect(props('/impostazioni/categorie/abc')).toEqual({ id: 'abc', kind: 'expense' })
    await router.push('/impostazioni/categorie/nuova')
    expect(document.title).toBe('Nuova categoria · Soldo')
    expect(router.currentRoute.value.meta.fullscreen).toBe(true)
  })

  it('translates the document title when the language changes', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/movimenti')
    applyLocale('en')
    await nextTick()
    expect(document.title).toBe('Transactions · Soldo')
  })
})
