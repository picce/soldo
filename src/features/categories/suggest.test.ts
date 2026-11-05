import { describe, expect, it } from 'vitest'
import { suggestColor, suggestIcon } from './suggest'

describe('suggestIcon', () => {
  it('takes the first icon of the picker not used yet', () => {
    expect(suggestIcon([])).toBe('shopping-cart')
    expect(suggestIcon([
      { icon: 'shopping-cart' },
      { icon: 'coffee' },
    ])).toBe('shopping-bag')
  })
})

describe('suggestColor', () => {
  it('takes the least used color, the earliest on a tie', () => {
    expect(suggestColor([])).toBe(1)
    // The default expenses: 1 to 4 twice, the others once.
    const defaults = [1, 2, 3, 4, 5, 7, 8, 1, 2, 3, 4, 6] as const
    expect(suggestColor(defaults.map(color => ({ color })))).toBe(5)
  })
})
