import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { restoreScroll, scrollRestored, whenScrollable } from './scroll'

let pageHeight = 0

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockImplementation(() => pageHeight)
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('whenScrollable', () => {
  it('resolves at once when the page is already tall enough', async () => {
    pageHeight = 3000
    const done = vi.fn()
    void whenScrollable(1500).then(done)
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toHaveBeenCalled()
  })

  it('waits for the rows to make the page taller', async () => {
    pageHeight = 800
    const done = vi.fn()
    void whenScrollable(1500).then(done)
    await vi.advanceTimersByTimeAsync(100)
    expect(done).not.toHaveBeenCalled()
    pageHeight = 2400
    await vi.advanceTimersByTimeAsync(50)
    expect(done).toHaveBeenCalled()
  })

  it('gives up after half a second', async () => {
    pageHeight = 800
    const done = vi.fn()
    void whenScrollable(1500).then(done)
    await vi.advanceTimersByTimeAsync(400)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(200)
    expect(done).toHaveBeenCalled()
  })
})

describe('restoreScroll', () => {
  const route = {} as Parameters<typeof restoreScroll>[0]

  it('starts a new page from the top', async () => {
    expect(restoreScroll(route, route, null)).toEqual({ top: 0 })
    await expect(scrollRestored()).resolves.toBeUndefined()
  })

  it('returns to the saved position once the page can reach it', async () => {
    pageHeight = 800
    const saved = { left: 0, top: 1200 }
    const position = restoreScroll(route, route, saved) as Promise<unknown>
    const done = vi.fn()
    void scrollRestored().then(done)
    await vi.advanceTimersByTimeAsync(50)
    expect(done).not.toHaveBeenCalled()
    pageHeight = 2400
    await vi.advanceTimersByTimeAsync(50)
    expect(done).toHaveBeenCalled()
    await expect(position).resolves.toBe(saved)
  })
})
