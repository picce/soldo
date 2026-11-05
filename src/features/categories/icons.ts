/**
 * Icons offered for a category, six per row as in the picker (mockup "Modifica
 * categoria"): food and home, transport, health and leisure, hobbies and family, then
 * the icons of the default categories that the first rows lack. Every name must be in
 * scripts/build-icons.js.
 */
export const CATEGORY_ICONS = [
  'shopping-cart',
  'shopping-bag',
  'coffee',
  'fork-knife',
  'house',
  'lightning',
  'car',
  'bus',
  'train',
  'bicycle',
  'gas-pump',
  'airplane-tilt',
  'first-aid',
  'pill',
  'barbell',
  'heart',
  'popcorn',
  'television',
  'game-controller',
  'music-notes',
  'book-open',
  'graduation-cap',
  'baby',
  'paw-print',
  't-shirt',
  'gift',
  'hand-coins',
  'briefcase',
  'arrow-counter-clockwise',
  'dots-three-outline',
] as const

/** i18n key of an icon's name, read by screen readers: `shopping-cart` → `categoryIcons.shoppingCart`. */
export function iconNameKey(icon: string): string {
  return `categoryIcons.${icon.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase())}`
}
