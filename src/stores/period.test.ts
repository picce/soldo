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
})
