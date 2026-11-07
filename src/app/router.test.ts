import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { db } from '@/db/database'
import { applyLocale } from '@/i18n/locale'
import { forgetOnboarding, markOnboarded } from './onboarding'
import { createAppRouter, requireOnboarding } from './router'

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
    ['/impostazioni/ricorrenze', 'recurrences'],
    ['/ricorrenze/abc', 'recurrence-edit'],
  ])('resolves %s to the %s route', (path, name) => {
    const router = createAppRouter(createMemoryHistory())
    expect(router.resolve(path).name).toBe(name)
  })

  it('opens the quick add with the repeat of the address, and ignores an unknown one', () => {
    const router = createAppRouter(createMemoryHistory())
    const targetOf = (path: string) => {
      const route = router.resolve(path)
      const props = route.matched[0]!.props.default as (route: unknown) => { target: unknown }
      return props(route).target
    }
    expect(targetOf('/nuovo/uscita?ripeti=mensile')).toEqual({ mode: 'new', kind: 'expense', repeat: 'monthly' })
    expect(targetOf('/nuovo/entrata?ripeti=settimanale')).toEqual({ mode: 'new', kind: 'income', repeat: 'weekly' })
    expect(targetOf('/nuovo/uscita?ripeti=spesso')).toEqual({ mode: 'new', kind: 'expense' })
    expect(targetOf('/ricorrenze/abc')).toEqual({ mode: 'rule', id: 'abc' })
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
    await router.push('/nuovo/trasferimento')
    expect(document.title).toBe('Nuovo trasferimento · Soldo')
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

describe('onboarding guard', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map(table => table.clear()))
    forgetOnboarding()
  })

  function guardedRouter() {
    const router = createAppRouter(createMemoryHistory())
    requireOnboarding(router)
    return router
  }

  it('leads every page to the welcome until the first start is done', async () => {
    const router = guardedRouter()
    await router.push('/movimenti')
    expect(router.currentRoute.value.name).toBe('welcome')
    expect(router.currentRoute.value.meta.fullscreen).toBe(true)
  })

  it('leads the welcome to the Home afterwards', async () => {
    await markOnboarded()
    const router = guardedRouter()
    await router.push('/movimenti')
    expect(router.currentRoute.value.name).toBe('transactions')
    await router.push('/benvenuto')
    expect(router.currentRoute.value.name).toBe('home')
  })
})
