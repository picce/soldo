import { describe, expect, it } from 'vitest'
import { currencyPlacement, formatAmount, isValidAmountCents, MINUS, parseAmount } from './money'

/** Intl puts a no-break space between the amount and the euro symbol in Italian. */
const NO_BREAK_SPACE = String.fromCharCode(0xA0)

describe('formatAmount', () => {
  it('formats cents with grouping and two decimals for each language', () => {
    expect(formatAmount(128430, 'it-IT')).toBe('1.284,30')
    expect(formatAmount(128430, 'en-GB')).toBe('1,284.30')
    expect(formatAmount(5, 'it-IT')).toBe('0,05')
  })

  it('uses the typographic minus and the requested sign', () => {
    expect(formatAmount(-1240, 'it-IT')).toBe(`${MINUS}12,40`)
    expect(formatAmount(116570, 'it-IT', { sign: 'always' })).toBe('+1.165,70')
    expect(formatAmount(-1240, 'it-IT', { sign: 'never' })).toBe('12,40')
    expect(formatAmount(0, 'it-IT', { sign: 'always' })).toBe('0,00')
  })

  it('adds the euro symbol where the language puts it', () => {
    expect(formatAmount(-1240, 'it-IT', { currency: true })).toBe(`${MINUS}12,40${NO_BREAK_SPACE}€`)
    expect(formatAmount(116570, 'en-GB', { currency: true, sign: 'always' })).toBe('+€1,165.70')
  })
})

describe('isValidAmountCents', () => {
  it('accepts positive integers only', () => {
    expect(isValidAmountCents(1)).toBe(true)
    expect(isValidAmountCents(0)).toBe(false)
    expect(isValidAmountCents(-5)).toBe(false)
    expect(isValidAmountCents(1.5)).toBe(false)
    expect(isValidAmountCents(Number.NaN)).toBe(false)
  })
})

describe('currencyPlacement', () => {
  it('puts the euro after the number in Italian and before it in English', () => {
    expect(currencyPlacement('it-IT')).toEqual({ position: 'after', symbol: '€' })
    expect(currencyPlacement('en-GB')).toEqual({ position: 'before', symbol: '€' })
  })
})

describe('parseAmount', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1234.56', 123456],
    ['1,234.56', 123456],
    ['12,5', 1250],
    ['1234', 123400],
    ['1.234', 123400],
    ['1.234.567', 123456700],
    [' 0,05 ', 5],
    ['0', 0],
  ])('reads %s', (text, cents) => {
    expect(parseAmount(text)).toBe(cents)
  })

  it.each([
    '',
    'abc',
    '-5',
    '12,',
    '1,2,3',
    '12.34.56',
    '1.23,45',
    '99999999999999999',
  ])('refuses «%s»', (text) => {
    expect(parseAmount(text)).toBeNull()
  })
})
