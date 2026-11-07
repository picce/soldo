import type { Transaction } from '@/db/schema'
import { showToast } from '@/app/toast'
import { getCategory } from '@/db/repositories/categories'
import { generateDueOccurrences } from '@/db/repositories/recurrences'
import { today } from '@/domain/dates'
import { i18n } from '@/i18n'
import { recurrenceName } from './describe'

/** Up to this many transactions the notice names them; beyond, it counts them. */
const NAMED = 3

/**
 * «Aggiunto dalle ricorrenze: Affitto», «Aggiunti dalle ricorrenze: Affitto, Netflix», or
 * «Aggiunti 5 movimenti dalle ricorrenze» when they are more, or the same name twice.
 */
export async function addedNotice(added: Transaction[]): Promise<string> {
  const { t } = i18n.global
  const names = await Promise.all(added.map(async transaction => recurrenceName(
    transaction,
    transaction.categoryId
      ? await getCategory(transaction.categoryId)
      : undefined,
  )))
  if (names.length > NAMED || new Set(names).size < names.length)
    return t('recurrences.addedMany', { n: names.length })
  return names.length === 1
    ? t('recurrences.addedOne', { name: names[0] })
    : t('recurrences.addedSome', {
        names: names.join(', '),
      })
}

/** Adds what the series have due today, and says so. */
export async function generateRecurring(): Promise<Transaction[]> {
  const added = await generateDueOccurrences(today())
  if (added.length)
    showToast({ message: await addedNotice(added) })
  return added
}

function run() {
  generateRecurring().catch(error => console.error(error))
}

/**
 * The series add their transactions when the app opens and when it comes back to the front: the
 * day may have changed while it stayed open in the background (docs/specs/ricorrenze.md).
 */
export function startRecurrences() {
  run()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible')
      run()
  })
}
