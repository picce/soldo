import type { Account, PaymentMethod, PaymentPreset } from './schema'
import { newRecord } from './records'

/** Default payment methods, in the order of the list. */
const DEFAULTS: [preset: PaymentPreset, icon: string][] = [
  ['cash', 'wallet'],
  ['card', 'credit-card'],
  ['satispay', 'device-mobile'],
  ['bankTransfer', 'bank'],
  ['other', 'dots-three-outline'],
]

/** The default payment methods, all charged to one account until the user changes them. */
export function defaultPaymentMethods(accountId: string): PaymentMethod[] {
  return DEFAULTS.map(([preset, icon], order) => ({
    ...newRecord(),
    preset,
    icon,
    accountId,
    order,
    archived: false,
  }))
}

/** The first account of the list that is neither deleted nor archived: the default one. */
export function firstActiveAccount<T extends Pick<Account, 'deletedAt' | 'archived' | 'order'>>(accounts: T[]): T | undefined {
  return accounts
    .filter(account => account.deletedAt === null && !account.archived)
    .sort((a, b) => a.order - b.order)[0]
}
