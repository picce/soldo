/** Icons offered for a payment method. Every name must be in scripts/build-icons.js. */
export const PAYMENT_ICONS = [
  'wallet',
  'credit-card',
  'device-mobile',
  'bank',
  'money',
  'dots-three-outline',
] as const

/** i18n key of an icon's name, read by screen readers. */
export function paymentIconKey(icon: string): string {
  return `paymentIcons.${icon.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase())}`
}
