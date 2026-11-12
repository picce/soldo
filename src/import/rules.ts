import { normalizeText } from '@/domain/search'

/**
 * Category rules of the import (docs/specs/released/import-da-file.md): «the description contains X
 * → category Y», for expenses or for income. Case and accents do not matter.
 */

export interface RuleLike {
  pattern: string
  kind: 'expense' | 'income'
  categoryId: string
}

/** The rule whose keyword is in the description; the longest wins (`amazon prime` over `amazon`). */
export function matchRule<T extends RuleLike>(description: string, kind: 'expense' | 'income', rules: readonly T[]): T | undefined {
  const text = normalizeText(description)
  let best: T | undefined
  let bestLength = 0
  for (const rule of rules) {
    const pattern = normalizeText(rule.pattern)
    if (rule.kind === kind && pattern && pattern.length > bestLength && text.includes(pattern)) {
      best = rule
      bestLength = pattern.length
    }
  }
  return best
}

/** Words the banks put around the name of who was paid. */
const SERVICE_WORDS = new Set([
  'pagamento',
  'pagam',
  'pag',
  'pos',
  'carta',
  'card',
  'credito',
  'debito',
  'bonifico',
  'bonif',
  'bon',
  'sepa',
  'sct',
  'sdd',
  'addebito',
  'addeb',
  'diretto',
  'accredito',
  'disposizione',
  'favore',
  'vostro',
  'vostra',
  'vs',
  'nostro',
  'ns',
  'stipendio',
  'emolumenti',
  'giroconto',
  'prelievo',
  'commissioni',
  'canone',
  'istantaneo',
  'ricevuto',
  'disposto',
  'ordinante',
  'beneficiario',
  'presso',
  'c/o',
  'op',
  'operazione',
  'num',
  'nr',
  'n',
  'rif',
  'ref',
  'del',
  'dal',
  'di',
  'da',
  'a',
  'al',
  'il',
  'la',
  'per',
  'in',
  'e',
  'ore',
  'eur',
  'euro',
  'contactless',
  'mastercard',
  'visa',
  'maestro',
  'bancomat',
  'pagobancomat',
  'apple',
  'google',
  'pay',
  'payment',
  'purchase',
  'direct',
  'debit',
  'transfer',
  'to',
  'from',
  'at',
  'the',
  'on',
  'of',
])

/**
 * The keyword proposed for a new rule: the first word that names who was paid, once the
 * words of the bank, dates, card numbers and codes are gone; two words when the first is
 * short (`bar sport`). Empty when nothing is left.
 */
export function suggestKeyword(description: string): string {
  const words = description
    .split(/[\s*/,;:()[\]]+/)
    .map(word => word.replace(/^[^\p{L}\d]+|[^\p{L}\d.&']+$/gu, ''))
    .filter(word => word.length >= 2
      && !/\d/.test(word)
      && !SERVICE_WORDS.has(normalizeText(word)))
  if (!words.length)
    return ''
  const [first, second] = words as [string, string | undefined]
  return first.length < 4 && second
    ? `${first} ${second}`
    : first
}
