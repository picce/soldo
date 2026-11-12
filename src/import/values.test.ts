import { describe, expect, it } from 'vitest'
import { detectDateFormat, parseDate, parseSignedAmount } from './values'

describe('parseSignedAmount', () => {
  it.each([
    ['-1.234,56', -123456],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['-12.50', -1250],
    ['12,50-', -1250],
    ['(12,50)', -1250],
    ['€ 12,50', 1250],
    ['-12,50 €', -1250],
    ['EUR -3,00', -300],
    ['+7,5', 750],
    ['−4,00', -400],
    ['1 234,56', 123456],
    [-45.9, -4590],
    [1850, 185000],
  ])('reads %s', (cell, cents) => {
    expect(parseSignedAmount(cell)).toBe(cents)
  })

  it.each([
    null,
    '',
    'Pagamento',
    '12/03/2026',
    '2026-03-12',
    '1,2,3',
    '12.03.26',
  ])('is not an amount: %s', (cell) => {
    expect(parseSignedAmount(cell)).toBeNull()
  })
})

describe('parseDate', () => {
  it('reads day first, month first and year first', () => {
    expect(parseDate('12/03/2026', 'dmy')).toBe('2026-03-12')
    expect(parseDate('12-03-26', 'dmy')).toBe('2026-03-12')
    expect(parseDate('12.03.2026 10:30', 'dmy')).toBe('2026-03-12')
    expect(parseDate('03/12/2026', 'mdy')).toBe('2026-03-12')
    expect(parseDate('2026-03-12', 'ymd')).toBe('2026-03-12')
    expect(parseDate('2026-03-12T09:00:00', 'ymd')).toBe('2026-03-12')
    expect(parseDate('20260312120000[+1:CET]', 'ymd')).toBe('2026-03-12')
    expect(parseDate('3/12\'26', 'mdy')).toBe('2026-03-12')
  })

  it('reads the dates of Excel', () => {
    expect(parseDate(46083, 'dmy')).toBe('2026-03-02')
    expect(parseDate(12, 'dmy')).toBeNull()
  })

  it('refuses dates that do not exist', () => {
    expect(parseDate('31/02/2026', 'dmy')).toBeNull()
    expect(parseDate('13/13/2026', 'dmy')).toBeNull()
    expect(parseDate('Saldo al 31/03/2026', 'dmy')).toBeNull()
  })
})

describe('detectDateFormat', () => {
  it('prefers the day first, as in Italy, when both read every date', () => {
    expect(detectDateFormat(['01/03/2026', '05/03/2026'])).toBe('dmy')
  })

  it('takes the month first when only that reads them all', () => {
    expect(detectDateFormat(['03/01/2026', '03/25/2026'])).toBe('mdy')
  })

  it('knows the year first, and nothing when no date is there', () => {
    expect(detectDateFormat(['2026-03-01', null, ''])).toBe('ymd')
    expect(detectDateFormat(['Esselunga', 'Bar'])).toBeNull()
  })
})
