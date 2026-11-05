import type { Category, PaletteColor } from '@/db/schema'
import { PALETTE_COLORS } from '@/components/palette'
import { CATEGORY_ICONS } from './icons'

/** Starting icon of a new category: the first in the picker that its kind does not use yet. */
export function suggestIcon(categories: Pick<Category, 'icon'>[]): string {
  const used = new Set(categories.map(category => category.icon))
  return CATEGORY_ICONS.find(icon => !used.has(icon)) ?? CATEGORY_ICONS[0]
}

/**
 * Starting color of a new category: the one its kind uses least, the earliest in the
 * palette on a tie, so neighbors in the grid tend to differ.
 */
export function suggestColor(categories: Pick<Category, 'color'>[]): PaletteColor {
  const uses = (color: PaletteColor) => categories.filter(category => category.color === color).length
  return PALETTE_COLORS.reduce((best, color) => uses(color) < uses(best)
    ? color
    : best)
}
