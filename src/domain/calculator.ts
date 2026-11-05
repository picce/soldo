/**
 * Calculator of the quick-add keypad (docs/specs/aggiunta-rapida.md, "Calcolatrice").
 *
 * The state keeps what the user typed; `evaluate` turns it into cents at any moment, so
 * the keypad needs no `=` key. Arithmetic is exact (fractions of BigInt) and only the
 * result is rounded to the cent, half away from zero: 10 ÷ 3 × 3 gives 10,00.
 * × and ÷ bind tighter than + and −, as on a phone calculator.
 */

export type Operator = '+' | '-' | '*' | '/'

export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

export type CalculatorKey = Digit | Operator | 'decimal' | 'backspace'

export interface CalculatorState {
  /** Numbers as typed, with `.` as decimal separator (`12`, `12.`, `12.5`). The last one may be empty. */
  readonly operands: readonly string[]
  /** `operators[i]` sits between `operands[i]` and `operands[i + 1]`. */
  readonly operators: readonly Operator[]
  /** Set after loading a saved amount: the next digit starts a new number instead of appending. */
  readonly replaceOnInput: boolean
}

export const MAX_INTEGER_DIGITS = 9
export const MAX_DECIMALS = 2
/** Largest amount the keypad can produce: 999.999.999,99. */
export const MAX_RESULT_CENTS = 99_999_999_999

const DIGITS = new Set<string>([
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
])
const OPERATORS = new Set<string>(['+', '-', '*', '/'])

export function isDigit(key: string): key is Digit {
  return DIGITS.has(key)
}

export function isOperator(key: string): key is Operator {
  return OPERATORS.has(key)
}

export function emptyCalculator(): CalculatorState {
  return {
    operands: [''],
    operators: [],
    replaceOnInput: false,
  }
}

/** State showing a saved amount (`1240` → `12.40`), replaced by the next digit. */
export function calculatorFromCents(cents: number): CalculatorState {
  if (!Number.isInteger(cents) || cents <= 0)
    return emptyCalculator()
  const euros = Math.floor(cents / 100)
  const rest = String(cents % 100).padStart(2, '0')
  return {
    operands: [`${euros}.${rest}`],
    operators: [],
    replaceOnInput: true,
  }
}

export function isEmptyCalculator(state: CalculatorState): boolean {
  return state.operators.length === 0 && state.operands[0] === ''
}

export function hasOperator(state: CalculatorState): boolean {
  return state.operators.length > 0
}

function withLast(state: CalculatorState, last: string): CalculatorState {
  return {
    operands: [
      ...state.operands.slice(0, -1),
      last,
    ],
    operators: state.operators,
    replaceOnInput: false,
  }
}

function typeDigit(last: string, digit: Digit): string {
  const [integer = '', decimals] = last.split('.')
  if (decimals !== undefined) {
    return decimals.length < MAX_DECIMALS
      ? last + digit
      : last
  }
  // No leading zeros: 0 followed by 5 is 5.
  if (integer === '0')
    return digit
  return integer.length < MAX_INTEGER_DIGITS
    ? last + digit
    : last
}

function typeDecimal(last: string): string {
  if (last.includes('.'))
    return last
  return last === ''
    ? '0.'
    : `${last}.`
}

/** The state after pressing a key. Keys that would make the expression invalid are ignored. */
export function pressKey(state: CalculatorState, key: CalculatorKey): CalculatorState {
  const last = state.operands.at(-1) ?? ''

  if (isDigit(key)) {
    if (state.replaceOnInput) {
      return {
        operands: [key],
        operators: [],
        replaceOnInput: false,
      }
    }
    return withLast(state, typeDigit(last, key))
  }

  if (key === 'decimal') {
    if (state.replaceOnInput) {
      return {
        operands: ['0.'],
        operators: [],
        replaceOnInput: false,
      }
    }
    return withLast(state, typeDecimal(last))
  }

  if (key === 'backspace') {
    if (last !== '')
      return withLast(state, last.slice(0, -1))
    if (state.operators.length === 0)
      return state
    // Removes the trailing operator: "8,90 +" becomes "8,90".
    return {
      operands: state.operands.slice(0, -1),
      operators: state.operators.slice(0, -1),
      replaceOnInput: false,
    }
  }

  // Operator.
  if (last === '') {
    // Nothing typed yet: there is nothing to operate on.
    if (state.operators.length === 0)
      return state
    // An operation right after another replaces it.
    return {
      operands: state.operands,
      operators: [
        ...state.operators.slice(0, -1),
        key,
      ],
      replaceOnInput: false,
    }
  }
  return {
    operands: [...state.operands, ''],
    operators: [...state.operators, key],
    replaceOnInput: false,
  }
}

/** Exact rational number: n / d, with d > 0. */
interface Fraction {
  n: bigint
  d: bigint
}

const ZERO = BigInt(0)
const ONE = BigInt(1)
const TWO = BigInt(2)
const HUNDRED = BigInt(100)

function gcd(a: bigint, b: bigint): bigint {
  let x = a < ZERO
    ? -a
    : a
  let y = b < ZERO
    ? -b
    : b
  while (y !== ZERO)
    [x, y] = [y, x % y]
  return x === ZERO
    ? ONE
    : x
}

function fraction(n: bigint, d: bigint): Fraction {
  const sign = d < ZERO
    ? -ONE
    : ONE
  const divisor = gcd(n, d)
  return { n: (sign * n) / divisor, d: (sign * d) / divisor }
}

/** `12.5` → 1250/100. */
function parseOperand(operand: string): Fraction {
  const [integer = '', decimals = ''] = operand.split('.')
  const cents = BigInt(`${integer || '0'}${decimals.padEnd(MAX_DECIMALS, '0')}`)
  return fraction(cents, HUNDRED)
}

function apply(a: Fraction, operator: Operator, b: Fraction): Fraction {
  switch (operator) {
    case '+':
      return fraction(a.n * b.d + b.n * a.d, a.d * b.d)
    case '-':
      return fraction(a.n * b.d - b.n * a.d, a.d * b.d)
    case '*':
      return fraction(a.n * b.n, a.d * b.d)
    case '/':
      // Dividing by zero leaves the amount as it was.
      return b.n === ZERO
        ? a
        : fraction(a.n * b.d, a.d * b.n)
  }
}

/** Fraction of euros to cents, rounding half away from zero. */
function toCents(value: Fraction): number {
  const scaled = value.n * HUNDRED
  let cents = scaled / value.d
  const remainder = scaled % value.d
  const doubled = (remainder < ZERO
    ? -remainder
    : remainder) * TWO
  if (doubled >= value.d) {
    cents += scaled < ZERO
      ? -ONE
      : ONE
  }
  return Number(cents)
}

/**
 * Result of the expression in cents. A trailing operator is ignored ("8,90 +" is 8,90).
 * It can be zero, negative or above MAX_RESULT_CENTS: the caller checks it before saving.
 */
export function evaluate(state: CalculatorState): number {
  const values = state.operands.map(parseOperand)
  const operators = [...state.operators]
  if (state.operands.at(-1) === '' && operators.length) {
    values.pop()
    operators.pop()
  }

  // × and ÷ first, left to right; then + and −.
  const terms: Fraction[] = [values[0] ?? fraction(ZERO, ONE)]
  const signs: Operator[] = []
  operators.forEach((operator, index) => {
    const value = values[index + 1] ?? fraction(ZERO, ONE)
    if (operator === '*' || operator === '/') {
      terms.push(apply(terms.pop()!, operator, value))
    }
    else {
      signs.push(operator)
      terms.push(value)
    }
  })
  const total = terms.slice(1).reduce((sum, term, index) => apply(sum, signs[index]!, term), terms[0]!)
  return toCents(total)
}

/** True when the expression gives an amount that can be saved. */
export function isValidResult(cents: number): boolean {
  return Number.isInteger(cents) && cents > 0 && cents <= MAX_RESULT_CENTS
}

const OPERATOR_SYMBOLS: Record<Operator, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
}

export function operatorSymbol(operator: Operator): string {
  return OPERATOR_SYMBOLS[operator]
}

/** Decimal separator of a locale: `,` for it-IT, `.` for en-GB. */
export function decimalSeparator(intlLocale: string): string {
  return new Intl.NumberFormat(intlLocale).formatToParts(1.5).find(part => part.type === 'decimal')?.value ?? '.'
}

/** A number as typed, in the locale: `1234.5` → `1.234,5` (it-IT). The typed decimals stay as they are. */
export function formatOperand(operand: string, intlLocale: string): string {
  if (operand === '')
    return ''
  const [integer = '', decimals] = operand.split('.')
  const grouped = new Intl.NumberFormat(intlLocale, { useGrouping: 'always', maximumFractionDigits: 0 })
    .format(Number(integer || '0'))
  return decimals === undefined
    ? grouped
    : `${grouped}${decimalSeparator(intlLocale)}${decimals}`
}

/** The expression as shown above the amount: `8,90 + 3,50`, or `8,90 +` while typing. */
export function formatExpression(state: CalculatorState, intlLocale: string): string {
  return state.operands
    .map((operand, index) => {
      const operator = state.operators[index]
      const text = formatOperand(operand, intlLocale)
      return operator
        ? `${text} ${operatorSymbol(operator)}`
        : text
    })
    .join(' ')
    .trim()
}
