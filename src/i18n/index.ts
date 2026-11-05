import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import it from './locales/it.json'

/** Languages of the app. Italian is the source language: every key starts in it.json. */
export const SUPPORTED_LOCALES = ['it', 'en'] as const

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export type MessageSchema = typeof it

/** Locale passed to Intl for numbers and dates, for each app language. */
export const INTL_LOCALES: Record<AppLocale, string> = {
  it: 'it-IT',
  en: 'en-GB',
}

export function isAppLocale(value: unknown): value is AppLocale {
  return SUPPORTED_LOCALES.includes(value as AppLocale)
}

// Messages are precompiled at build time by @intlify/unplugin-vue-i18n (see vite.config.ts),
// so the app ships the vue-i18n runtime without the message compiler.
export const i18n = createI18n<[MessageSchema], AppLocale, false>({
  legacy: false,
  locale: 'it',
  fallbackLocale: 'it',
  messages: { it, en },
})
