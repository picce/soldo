import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '.'
import { applyLocale, LOCALE_STORAGE_KEY, readLocalePreference, resolveLocale, useLocalePreference } from './locale'
import enMessages from './locales/en.json'
import itMessages from './locales/it.json'

/** A message precompiled by @intlify/unplugin-vue-i18n: an AST with a type and a body. */
function isMessage(value: object): boolean {
  return ('type' in value || 't' in value) && ('body' in value || 'b' in value)
}

/** Message keys only: the inside of each precompiled message differs between languages. */
function keysOf(messages: object, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null && !isMessage(value)
      ? keysOf(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  ).sort()
}

afterEach(() => {
  localStorage.clear()
  applyLocale('it')
})

describe('resolveLocale', () => {
  it('uses the language the user picked', () => {
    expect(resolveLocale('it', ['en-US'])).toBe('it')
    expect(resolveLocale('en', ['it-IT'])).toBe('en')
  })

  it('takes the first supported device language', () => {
    expect(resolveLocale('auto', ['de-DE', 'it-CH', 'en-US'])).toBe('it')
    expect(resolveLocale('auto', ['en-GB', 'it-IT'])).toBe('en')
  })

  it('falls back to English when no device language is supported', () => {
    expect(resolveLocale('auto', ['de-DE', 'fr'])).toBe('en')
    expect(resolveLocale('auto', [])).toBe('en')
  })
})

describe('messages', () => {
  it('have the same keys in every language', () => {
    expect(keysOf(enMessages)).toEqual(keysOf(itMessages))
  })
})

describe('locale preference', () => {
  it('is automatic until the user picks a language', () => {
    expect(readLocalePreference()).toBe('auto')
    localStorage.setItem(LOCALE_STORAGE_KEY, 'fr')
    expect(readLocalePreference()).toBe('auto')
  })

  it('saves and applies the choice', () => {
    const preference = useLocalePreference()
    preference.value = 'en'
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
    expect(i18n.global.locale.value).toBe('en')
    expect(document.documentElement.lang).toBe('en')

    preference.value = 'it'
    expect(i18n.global.locale.value).toBe('it')
    expect(document.documentElement.lang).toBe('it')

    preference.value = 'auto'
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull()
  })
})
