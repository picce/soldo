import type { PaletteColor } from '@/db/schema'

/** The eight category colors, in the fixed order of the palette (docs/design/README.md). */
export const PALETTE_COLORS: readonly PaletteColor[] = [1, 2, 3, 4, 5, 6, 7, 8]

const NAMES = [
  'blue',
  'orange',
  'teal',
  'ochre',
  'pink',
  'green',
  'purple',
  'red',
] as const

/** i18n key of a color's name ("Blu", "Arancio", …), read by screen readers and shown when chosen. */
export function colorNameKey(color: PaletteColor): string {
  return `palette.${NAMES[color - 1]}`
}
