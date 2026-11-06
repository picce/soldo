import type { Account } from '@/db/schema'

/** Icons offered for an account. Every name must be in scripts/build-icons.js. */
export const ACCOUNT_ICONS = [
  'wallet',
  'credit-card',
  'bank',
  'piggy-bank',
  'coins',
  'vault',
] as const

/** i18n key of an icon's name, read by screen readers. */
export function accountIconKey(icon: string): string {
  return `accountIcons.${icon.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase())}`
}

/** Starting icon of a new account: the first in the picker that no other account uses. */
export function suggestAccountIcon(accounts: Pick<Account, 'icon'>[]): string {
  const used = new Set(accounts.map(account => account.icon))
  return ACCOUNT_ICONS.find(icon => !used.has(icon)) ?? ACCOUNT_ICONS[0]
}
