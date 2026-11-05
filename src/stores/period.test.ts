import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { today } from '@/domain/dates'
import { usePeriodStore } from './period'

beforeEach(() => setActivePinia(createPinia()))

describe('period store', () => {
  it('starts on the current month', () => {
    expect(usePeriodStore().period).toEqual({
      unit: 'month',
      anchor: today(),
    })
  })

  it('moves by whole periods', () => {
    const store = usePeriodStore()
    store.period = { unit: 'month', anchor: '2026-11-05' }
    store.shift(-1)
    expect(store.period).toEqual({ unit: 'month', anchor: '2026-10-01' })
    expect(store.direction).toBe(-1)
  })

  it('keeps today when changing unit from a period that includes it', () => {
    const store = usePeriodStore()
    store.setUnit('day')
    expect(store.period).toEqual({
      unit: 'day',
      anchor: today(),
    })
  })

  it('keeps the start of a past period when changing unit', () => {
    const store = usePeriodStore()
    store.period = { unit: 'month', anchor: '2020-03-01' }
    store.setUnit('week')
    expect(store.period).toEqual({ unit: 'week', anchor: '2020-03-01' })
  })

  it('goes back to today from the past and from the future, keeping the unit', () => {
    const store = usePeriodStore()
    expect(store.isCurrent).toBe(true)

    store.period = { unit: 'week', anchor: '2020-03-01' }
    expect(store.isCurrent).toBe(false)
    store.goToToday()
    expect(store.period).toEqual({
      unit: 'week',
      anchor: today(),
    })
    expect(store.direction).toBe(1)
    expect(store.isCurrent).toBe(true)

    store.period = { unit: 'year', anchor: '2999-01-01' }
    store.goToToday()
    expect(store.period).toEqual({
      unit: 'year',
      anchor: today(),
    })
    expect(store.direction).toBe(-1)
  })
})
