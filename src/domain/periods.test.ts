import { describe, expect, it } from 'vitest'
import { isInPeriod, periodLabel, periodRange, shiftPeriod } from './periods'

describe('periodRange', () => {
  it('covers day, week from Monday, month and year', () => {
    // 2026-11-05 is a Thursday.
    expect(periodRange({ unit: 'day', anchor: '2026-11-05' })).toEqual({ from: '2026-11-05', to: '2026-11-05' })
    expect(periodRange({ unit: 'week', anchor: '2026-11-05' })).toEqual({ from: '2026-11-02', to: '2026-11-08' })
    expect(periodRange({ unit: 'week', anchor: '2026-11-08' })).toEqual({ from: '2026-11-02', to: '2026-11-08' })
    expect(periodRange({ unit: 'month', anchor: '2026-02-14' })).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(periodRange({ unit: 'year', anchor: '2026-11-05' })).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })

  it('handles weeks across months and years', () => {
    expect(periodRange({ unit: 'week', anchor: '2026-10-30' })).toEqual({ from: '2026-10-26', to: '2026-11-01' })
    expect(periodRange({ unit: 'week', anchor: '2027-01-01' })).toEqual({ from: '2026-12-28', to: '2027-01-03' })
  })
})

describe('shiftPeriod', () => {
  it('moves by whole periods and anchors to the first day', () => {
    expect(shiftPeriod({ unit: 'month', anchor: '2026-01-31' }, 1)).toEqual({ unit: 'month', anchor: '2026-02-01' })
    expect(shiftPeriod({ unit: 'month', anchor: '2026-01-15' }, -1)).toEqual({ unit: 'month', anchor: '2025-12-01' })
    expect(shiftPeriod({ unit: 'week', anchor: '2026-11-05' }, 1)).toEqual({ unit: 'week', anchor: '2026-11-09' })
    expect(shiftPeriod({ unit: 'day', anchor: '2026-03-29' }, 1)).toEqual({ unit: 'day', anchor: '2026-03-30' })
    expect(shiftPeriod({ unit: 'year', anchor: '2026-11-05' }, -1)).toEqual({ unit: 'year', anchor: '2025-01-01' })
  })
})

describe('isInPeriod', () => {
  it('includes both ends', () => {
    const november = { unit: 'month', anchor: '2026-11-05' } as const
    expect(isInPeriod('2026-11-01', november)).toBe(true)
    expect(isInPeriod('2026-11-30', november)).toBe(true)
    expect(isInPeriod('2026-12-01', november)).toBe(false)
  })
})

describe('periodLabel', () => {
  it('names periods in each language', () => {
    expect(periodLabel({ unit: 'month', anchor: '2026-11-05' }, 'it-IT')).toBe('Novembre 2026')
    expect(periodLabel({ unit: 'month', anchor: '2026-11-05' }, 'en-GB')).toBe('November 2026')
    expect(periodLabel({ unit: 'day', anchor: '2026-11-05' }, 'it-IT')).toBe('5 novembre 2026')
    expect(periodLabel({ unit: 'year', anchor: '2026-11-05' }, 'it-IT')).toBe('2026')
  })

  it('shows weeks as a range', () => {
    expect(periodLabel({ unit: 'week', anchor: '2026-11-05' }, 'it-IT')).toBe('2–8 novembre')
    expect(periodLabel({ unit: 'week', anchor: '2026-11-05' }, 'en-GB')).toBe('2–8 November')
    expect(periodLabel({ unit: 'week', anchor: '2026-10-30' }, 'en-GB')).toBe('26 October – 1 November')
  })
})
