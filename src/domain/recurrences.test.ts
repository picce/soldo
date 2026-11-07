import type { RecurrenceSchedule } from './recurrences'
import { describe, expect, it } from 'vitest'
import {
  dueOccurrences,
  isFinished,
  isValidInterval,
  MAX_DUE,
  nextOccurrence,
  nextOccurrences,
  occurrence,
  occurrenceId,
} from './recurrences'

function schedule(changes: Partial<RecurrenceSchedule> = {}): RecurrenceSchedule {
  return {
    freq: 'monthly',
    interval: 1,
    startDate: '2026-01-31',
    ...changes,
  }
}

describe('occurrence', () => {
  it('counts every frequency from the start, with its interval', () => {
    expect(occurrence(schedule({ freq: 'daily', interval: 3, startDate: '2026-11-07' }), 2)).toBe('2026-11-13')
    expect(occurrence(schedule({ freq: 'weekly', interval: 2, startDate: '2026-11-07' }), 1)).toBe('2026-11-21')
    expect(occurrence(schedule({ freq: 'yearly', interval: 1, startDate: '2026-11-07' }), 3)).toBe('2029-11-07')
    expect(occurrence(schedule({ freq: 'monthly', interval: 3, startDate: '2026-11-07' }), 1)).toBe('2027-02-07')
  })

  it('keeps the day of the month after a short month', () => {
    const rent = schedule()
    expect([0, 1, 2, 3].map(k => occurrence(rent, k))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ])
    expect(occurrence(rent, 25)).toBe('2028-02-29')
  })

  it('falls on 28 February in the years without the 29th', () => {
    const birthday = schedule({ freq: 'yearly', startDate: '2028-02-29' })
    expect([1, 4].map(k => occurrence(birthday, k))).toEqual(['2029-02-28', '2032-02-29'])
  })
})

describe('dueOccurrences', () => {
  it('gives every date from the start up to today', () => {
    expect(dueOccurrences(schedule(), '2026-04-15')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
    expect(dueOccurrences(schedule({ startDate: '2026-11-07' }), '2026-11-07')).toEqual(['2026-11-07'])
  })

  it('skips what was already added', () => {
    expect(dueOccurrences(schedule({ lastGeneratedDate: '2026-02-28' }), '2026-04-30')).toEqual(['2026-03-31', '2026-04-30'])
    expect(dueOccurrences(schedule({ lastGeneratedDate: '2026-04-30' }), '2026-04-30')).toEqual([])
  })

  it('finds the next dates of an old daily series without counting from its start', () => {
    const coffee = schedule({ freq: 'daily', startDate: '2016-01-01', lastGeneratedDate: '2026-11-05' })
    expect(dueOccurrences(coffee, '2026-11-07')).toEqual(['2026-11-06', '2026-11-07'])
  })

  it('stops at the end date and has nothing before the start', () => {
    expect(dueOccurrences(schedule({ endDate: '2026-03-30' }), '2026-12-31')).toEqual(['2026-01-31', '2026-02-28'])
    expect(dueOccurrences(schedule({ startDate: '2026-12-01' }), '2026-11-07')).toEqual([])
  })

  it('adds at most a thousand at a time', () => {
    const daily = schedule({ freq: 'daily', startDate: '2020-01-01' })
    const first = dueOccurrences(daily, '2026-11-07')
    expect(first).toHaveLength(MAX_DUE)
    const rest = dueOccurrences({
      ...daily,
      lastGeneratedDate: first.at(-1),
    }, '2026-11-07')
    expect(rest[0]).toBe('2022-09-27')
    const last = dueOccurrences({
      ...daily,
      lastGeneratedDate: rest.at(-1),
    }, '2026-11-07')
    expect(last.at(-1)).toBe('2026-11-07')
    expect(first.length + rest.length + last.length).toBe(2503)
  })
})

describe('nextOccurrences', () => {
  it('lists the dates after today up to a day', () => {
    const rent = schedule({ startDate: '2026-01-01', lastGeneratedDate: '2026-11-01' })
    expect(nextOccurrences(rent, '2026-11-07', '2027-01-15')).toEqual(['2026-12-01', '2027-01-01'])
    expect(nextOccurrence(rent, '2026-11-07')).toBe('2026-12-01')
  })

  it('starts with the first date of a series that has not started yet', () => {
    expect(nextOccurrence(schedule({ startDate: '2026-12-01' }), '2026-11-07')).toBe('2026-12-01')
  })

  it('says when a series is over', () => {
    expect(isFinished(schedule({ endDate: '2026-11-07' }), '2026-11-07')).toBe(true)
    expect(isFinished(schedule({ endDate: '2026-11-30' }), '2026-11-07')).toBe(false)
    expect(isFinished(schedule(), '2030-01-01')).toBe(false)
  })
})

it('names an occurrence by its series and its day', () => {
  expect(occurrenceId('rule-1', '2026-11-07')).toBe('rule-1:2026-11-07')
})

it('accepts an interval from 1 to 99', () => {
  expect([0, 1, 99, 100, 1.5].map(isValidInterval)).toEqual([false, true, true, false, false])
})
