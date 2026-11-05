import type { AppLocale } from '.'
import { computed, ref } from 'vue'
import { i18n, INTL_LOCALES, isAppLocale } from '.'

/** What the user picked in Settings: `auto` follows the device language. */
export type LocalePreference = 'auto' | AppLocale

export const LOCALE_STORAGE_KEY = 'soldo:locale'

/** Language used when none of the device languages is supported. */
const DEFAULT_LOCALE: AppLocale = 'en'

/**
 * Picks the app language. With `auto` it takes the first device language the app
 * supports, comparing only the primary subtag (`it-CH` counts as `it`).
 */
export function resolveLocale(preference: LocalePreference, languages: readonly string[]): AppLocale {
  if (preference !== 'auto')
    return preference
  for (const language of languages) {
    const primary = language.toLowerCase().split('-')[0]
    if (isAppLocale(primary))
      return primary
  }
  return DEFAULT_LOCALE
}

function deviceLanguages(): readonly string[] {
  return navigator.languages?.length
    ? navigator.languages
    : [navigator.language]
}

// localStorage can be missing or throw (private mode, blocked storage): fall back to `auto`.
export function readLocalePreference(): LocalePreference {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isAppLocale(stored))
      return stored
  }
  catch {}
  return 'auto'
}

function writeLocalePreference(preference: LocalePreference) {
  try {
    if (preference === 'auto')
      localStorage.removeItem(LOCALE_STORAGE_KEY)
    else
      localStorage.setItem(LOCALE_STORAGE_KEY, preference)
  }
  catch {}
}

/** Applies a language to vue-i18n and to `<html lang>`. */
export function applyLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  document.documentElement.lang = locale
}

/** Applies the stored preference; with `auto`, follows later changes of the device language. */
export function initLocale() {
  applyLocale(resolveLocale(readLocalePreference(), deviceLanguages()))
  window.addEventListener('languagechange', () => {
    if (readLocalePreference() === 'auto')
      applyLocale(resolveLocale('auto', deviceLanguages()))
  })
}

/** The language preference as a writable ref: setting it saves and applies the choice. */
export function useLocalePreference() {
  const current = ref<LocalePreference>(readLocalePreference())
  return computed<LocalePreference>({
    get: () => current.value,
    set: (preference) => {
      current.value = preference
      writeLocalePreference(preference)
      applyLocale(resolveLocale(preference, deviceLanguages()))
    },
  })
}

/** Locale for Intl (numbers, dates) of the current app language: `it-IT` or `en-GB`. */
export function intlLocale(): string {
  return INTL_LOCALES[i18n.global.locale.value]
}

/** `intlLocale()` as a computed ref, for templates. */
export function useIntlLocale() {
  return computed(intlLocale)
}
