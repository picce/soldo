import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from './router'

describe('router', () => {
  it.each([
    ['/', 'home'],
    ['/movimenti', 'transactions'],
    ['/budget', 'budget'],
    ['/statistiche', 'stats'],
    ['/impostazioni', 'settings'],
  ])('risolve %s nella rotta %s', (path, name) => {
    const router = createAppRouter(createMemoryHistory())
    expect(router.resolve(path).name).toBe(name)
  })

  it('reindirizza le rotte sconosciute alla home', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/non-esiste')
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('aggiorna il titolo del documento', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/movimenti')
    expect(document.title).toBe('Movimenti · Soldo')
    await router.push('/')
    expect(document.title).toBe('Soldo')
  })
})
