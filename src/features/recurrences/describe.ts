import type { Category, Recurrence, Transaction } from '@/db/schema'
import { categoryName } from '@/db/names'
import { i18n } from '@/i18n'

/**
 * Words for a series (docs/specs/ricorrenze.md): how often it repeats and what it is called.
 * Through the global i18n, so notices outside components can use them too.
 */

type Frequency = Pick<Recurrence, 'freq' | 'interval'>

/** «Ogni mese», «Ogni 2 settimane». */
export function describeEvery({ freq, interval }: Frequency): string {
  return i18n.global.t(`repeat.every.${freq}`, interval)
}

/** The same inside a sentence: «ogni mese». */
export function describeEveryInline({ freq, interval }: Frequency): string {
  return i18n.global.t(`repeat.everyInline.${freq}`, interval)
}

/** After the date on the button of the quick add: «Oggi · mensile», «Oggi · ogni 2 mesi». */
export function describeShort({ freq, interval }: Frequency): string {
  return interval === 1
    ? i18n.global.t(`repeat.chip.${freq}`)
    : describeEveryInline({ freq, interval })
}

/** Name of a series or of one of its transactions: the note, else the category, else «Trasferimento». */
export function recurrenceName(fields: Pick<Transaction, 'kind' | 'note'>, category?: Category): string {
  if (fields.note)
    return fields.note
  if (category)
    return categoryName(category)
  return fields.kind === 'transfer'
    ? i18n.global.t('transactions.transfer')
    : ''
}
