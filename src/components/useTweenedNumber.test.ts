import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { TWEEN_DURATION, useTweenedNumber } from './useTweenedNumber'

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
      'setTimeout',
    ],
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function tween(enabled = true) {
  const source = ref(1000)
  const scope = effectScope()
  const value = scope.run(() => useTweenedNumber(() => source.value, () => enabled))!
  return {
    source,
    value,
    stop: () => scope.stop(),
  }
}

describe('useTweenedNumber', () => {
  it('shows the first value at once', () => {
    const { value, stop } = tween()
    expect(value.value).toBe(1000)
    stop()
  })

  it('runs from the old value to the new one', async () => {
    const { source, value, stop } = tween()
    source.value = 2000
    await nextTick()
    expect(value.value).toBe(1000)
    vi.advanceTimersByTime(TWEEN_DURATION / 2)
    expect(value.value).toBeGreaterThan(1000)
    expect(value.value).toBeLessThan(2000)
    vi.advanceTimersByTime(TWEEN_DURATION)
    expect(value.value).toBe(2000)
    stop()
  })

  it('changes at once when disabled or with «Riduci movimento»', async () => {
    const disabled = tween(false)
    disabled.source.value = 3000
    await nextTick()
    expect(disabled.value.value).toBe(3000)
    disabled.stop()

    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
      matches: query.includes('reduce'),
    }) as MediaQueryList)
    const reduced = tween()
    reduced.source.value = 3000
    await nextTick()
    expect(reduced.value.value).toBe(3000)
    reduced.stop()
  })
})
