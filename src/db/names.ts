import type { Account, Category } from './schema'
import { i18n } from '@/i18n'

/**
 * Display name of a category: the user's name, or the translation of its preset, so the
 * defaults follow the app language until the user renames them (docs/specs/dati-locali.md).
 */
export function categoryName(category: Pick<Category, 'name' | 'preset'>): string {
  if (category.name)
    return category.name
  return category.preset
    ? i18n.global.t(`presets.categories.${category.preset}`)
    : ''
}

export function accountName(account: Pick<Account, 'name' | 'preset'>): string {
  if (account.name)
    return account.name
  return account.preset
    ? i18n.global.t(`presets.accounts.${account.preset}`)
    : ''
}
