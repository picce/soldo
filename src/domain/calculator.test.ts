import type { CalculatorKey, CalculatorState } from './calculator'
import { describe, expect, it } from 'vitest'
import {
  calculatorFromCents,
  emptyCalculator,
  evaluate,
  formatExpression,
  formatOperand,
  hasOperator,
  isEmptyCalculator,
  isValidResult,
  MAX_RESULT_CENTS,
  pressKey,
} from './calculator'

/** Presses keys written as a string: digits, `,` for the decimal key, `+-*\/`, `<` for backspace. */
function type(keys: string, state: CalculatorState = emptyCalculator()): CalculatorState {
  return [...keys].reduce((current, char) => {
    const key: CalculatorKey = char === ','
      ? 'decimal'
      : char === '<'
        ? 'backspace'
        : char as CalculatorKey
    return pressKey(current, key)
  }, state)
}

describe('calculator input', () => {
  it('types digits and one decimal separator', () => {
    expect(type('12,5').operands).toEqual(['12.5'])
    expect(type('12,,5').operands).toEqual(['12.5'])
    expect(type(',5').operands).toEqual(['0.5'])
  })

  it('drops leading zeros', () => {
    expect(type('007').operands).toEqual(['7'])
    expect(type('0,05').operands).toEqual(['0.05'])
  })

  it('stops at two decimals and nine integer digits', () => {
    expect(type('1,234').operands).toEqual(['1.23'])
    expect(type('12345678901').operands).toEqual(['123456789'])
    expect(type('123456789,99').operands).toEqual(['123456789.99'])
  })

  it('ignores an operator before any number', () => {
    expect(isEmptyCalculator(type('+'))).toBe(true)
    expect(isEmptyCalculator(type('*5'))).toBe(false)
    expect(type('*5').operators).toEqual([])
  })

  it('replaces an operation typed right after another', () => {
    const state = type('8+-*')
    expect(state.operands).toEqual(['8', ''])
    expect(state.operators).toEqual(['*'])
  })

  it('deletes digits, then the trailing operator', () => {
    expect(type('12,5<').operands).toEqual(['12.'])
    expect(type('12,5<<').operands).toEqual(['12'])
    const afterOperator = type('8+<')
    expect(afterOperator.operands).toEqual(['8'])
    expect(hasOperator(afterOperator)).toBe(false)
    expect(isEmptyCalculator(type('8<<<'))).toBe(true)
  })
})

describe('evaluate', () => {
  it('gives cents for a single number', () => {
    expect(evaluate(emptyCalculator())).toBe(0)
    expect(evaluate(type('12'))).toBe(1200)
    expect(evaluate(type('12,'))).toBe(1200)
    expect(evaluate(type('12,4'))).toBe(1240)
    expect(evaluate(type('0,05'))).toBe(5)
  })

  it('computes while typing, ignoring a trailing operator', () => {
    expect(evaluate(type('8,9+3,5'))).toBe(1240)
    expect(evaluate(type('8,9+'))).toBe(890)
    expect(evaluate(type('20-7,5'))).toBe(1250)
  })

  it('multiplies and divides before adding', () => {
    expect(evaluate(type('2+3*4'))).toBe(1400)
    expect(evaluate(type('10-6/3'))).toBe(800)
    expect(evaluate(type('1,5*3'))).toBe(450)
  })

  it('is exact and rounds only the result, half up', () => {
    expect(evaluate(type('10/3'))).toBe(333)
    expect(evaluate(type('10/3*3'))).toBe(1000)
    expect(evaluate(type('0,1+0,2'))).toBe(30)
    expect(evaluate(type('2/3'))).toBe(67)
    expect(evaluate(type('0,05/2'))).toBe(3)
  })

  it('leaves the amount unchanged when dividing by zero', () => {
    expect(evaluate(type('12/0'))).toBe(1200)
    expect(evaluate(type('12/0,5'))).toBe(2400)
  })

  it('can give results that cannot be saved', () => {
    expect(evaluate(type('5-10'))).toBe(-500)
    expect(isValidResult(evaluate(type('5-10')))).toBe(false)
    expect(isValidResult(evaluate(type('5-5')))).toBe(false)
    expect(isValidResult(evaluate(type('999999999*10')))).toBe(false)
    expect(isValidResult(MAX_RESULT_CENTS)).toBe(true)
  })
})

describe('saved amounts', () => {
  it('loads cents and replaces them with the next digit', () => {
    const loaded = calculatorFromCents(1240)
    expect(loaded.operands).toEqual(['12.40'])
    expect(evaluate(loaded)).toBe(1240)
    expect(type('5', loaded).operands).toEqual(['5'])
    expect(type(',5', loaded).operands).toEqual(['0.5'])
  })

  it('keeps the loaded amount for operators and backspace', () => {
    const loaded = calculatorFromCents(1240)
    expect(evaluate(type('*2', loaded))).toBe(2480)
    expect(type('<', loaded).operands).toEqual(['12.4'])
    expect(type('<5', loaded).operands).toEqual(['12.45'])
  })
})

describe('formatting', () => {
  it('formats typed numbers in the locale', () => {
    expect(formatOperand('1234.5', 'it-IT')).toBe('1.234,5')
    expect(formatOperand('1234.', 'it-IT')).toBe('1.234,')
    expect(formatOperand('1234.5', 'en-GB')).toBe('1,234.5')
    expect(formatOperand('', 'it-IT')).toBe('')
  })

  it('shows the expression with typographic operators', () => {
    expect(formatExpression(type('8,9+3,5'), 'it-IT')).toBe('8,9 + 3,5')
    expect(formatExpression(type('8,9-'), 'it-IT')).toBe('8,9 −')
    expect(formatExpression(type('3*4/2'), 'en-GB')).toBe('3 × 4 ÷ 2')
  })
})
