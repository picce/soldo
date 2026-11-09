import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { appLock, ATTEMPTS_KEY, changeLockDelay, disableLock, enableLock, LOCK_KEY, locked, reloadLock, startLock, unlock, waitUntil } from './lock'

// A few iterations: the real 100,000 would make each test wait.
const ITERATIONS = 10

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  localStorage.clear()
  reloadLock()
})

afterEach(() => {
  vi.useRealTimers()
  setVisibility('visible')
})

describe('pIN lock', () => {
  it('is off until a PIN turns it on, and never keeps the PIN', async () => {
    expect(appLock.value).toBeNull()
    startLock()
    expect(locked.value).toBe(false)
    await enableLock('2468', 60, ITERATIONS)
    expect(appLock.value).toEqual({ after: 60 })
    expect(localStorage.getItem(LOCK_KEY)).not.toContain('2468')
    startLock()
    expect(locked.value).toBe(true)
  })

  it('opens with the right PIN only', async () => {
    await enableLock('2468', 0, ITERATIONS)
    startLock()
    expect(await unlock('1357')).toBe('wrong')
    expect(locked.value).toBe(true)
    expect(await unlock('2468')).toBe('ok')
    expect(locked.value).toBe(false)
  })

  it('waits longer and longer after five wrong PINs, also after a reload', async () => {
    await enableLock('2468', 0, ITERATIONS)
    startLock()
    const now = Date.UTC(2026, 10, 9, 10)
    for (let attempt = 1; attempt < 5; attempt++)
      expect(await unlock('0000', now)).toBe('wrong')
    expect(await unlock('0000', now)).toBe('wait')
    expect(waitUntil(now)).toBe(now + 30_000)
    // Even the right PIN waits.
    expect(await unlock('2468', now + 10_000)).toBe('wait')
    reloadLock()
    expect(waitUntil(now + 10_000)).toBe(now + 30_000)
    // The next wrong one waits twice as long.
    expect(await unlock('0000', now + 31_000)).toBe('wait')
    expect(waitUntil(now + 31_000)).toBe(now + 31_000 + 60_000)
    startLock()
    expect(await unlock('2468', now + 92_000)).toBe('ok')
    expect(localStorage.getItem(ATTEMPTS_KEY)).toBeNull()
  })

  it('locks again only after the chosen time out of the app', async () => {
    vi.useFakeTimers({
      toFake: ['Date'],
    })
    vi.setSystemTime(Date.UTC(2026, 10, 9, 10))
    await enableLock('2468', 60, ITERATIONS)
    startLock()
    await unlock('2468')

    setVisibility('hidden')
    vi.setSystemTime(Date.UTC(2026, 10, 9, 10, 0, 30))
    setVisibility('visible')
    expect(locked.value).toBe(false)

    setVisibility('hidden')
    vi.setSystemTime(Date.UTC(2026, 10, 9, 10, 2))
    setVisibility('visible')
    expect(locked.value).toBe(true)
  })

  it('with «at once» still lets a file be picked, but locks after a real break', async () => {
    vi.useFakeTimers({
      toFake: ['Date'],
    })
    vi.setSystemTime(Date.UTC(2026, 10, 9, 10))
    await enableLock('2468', 0, ITERATIONS)
    startLock()
    await unlock('2468')

    setVisibility('hidden')
    vi.setSystemTime(Date.UTC(2026, 10, 9, 10, 0, 1))
    setVisibility('visible')
    expect(locked.value).toBe(false)

    setVisibility('hidden')
    vi.setSystemTime(Date.UTC(2026, 10, 9, 10, 0, 10))
    setVisibility('visible')
    expect(locked.value).toBe(true)
  })

  it('changes the delay, and turned off forgets everything', async () => {
    await enableLock('2468', 0, ITERATIONS)
    changeLockDelay(300)
    expect(appLock.value).toEqual({ after: 300 })
    startLock()
    disableLock()
    expect(locked.value).toBe(false)
    expect(appLock.value).toBeNull()
    expect(localStorage.getItem(LOCK_KEY)).toBeNull()
  })
})
