/** Typographic minus sign, used instead of the hyphen in amounts (docs/design, "Tipografia"). */
export const MINUS = '−'

const MAX_CENTS = Number.MAX_SAFE_INTEGER

/** Amounts are integer cents, never floats. */
export function isValidAmountCents(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= MAX_CENTS
}

export interface FormatAmountOptions {
  /** `auto`: minus only when negative; `always`: also + when positive (the balance); `never`: no sign. */
  sign?: 'auto' | 'always' | 'never'
  /** Adds the euro symbol where the locale puts it. Columns of figures omit it. */
  currency?: boolean
}

/**
 * Formats cents for display, e.g. `1.284,30` in `it-IT` and `1,284.30` in `en-GB`.
 * `intlLocale` comes from INTL_LOCALES in src/i18n.
 */
export function formatAmount(cents: number, intlLocale: string, options: FormatAmountOptions = {}): string {
  const { sign = 'auto', currency = false } = options
  const formatter = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: 'always',
    ...(currency
      ? { style: 'currency', currency: 'EUR' }
      : {}),
  })
  const body = formatter.format(Math.abs(cents) / 100)
  if (cents < 0 && sign !== 'never')
    return `${MINUS}${body}`
  if (cents > 0 && sign === 'always')
    return `+${body}`
  return body
}

/** Where a locale puts the euro symbol, and the symbol itself: `after` in it-IT (`12,40 €`), `before` in en-GB (`€12.40`). */
export function currencyPlacement(intlLocale: string): { position: 'before' | 'after', symbol: string } {
  const parts = new Intl.NumberFormat(intlLocale, { style: 'currency', currency: 'EUR' }).formatToParts(1)
  const currencyIndex = parts.findIndex(part => part.type === 'currency')
  const integerIndex = parts.findIndex(part => part.type === 'integer')
  return {
    position: currencyIndex < integerIndex
      ? 'before'
      : 'after',
    symbol: parts[currencyIndex]?.value ?? '€',
  }
}
