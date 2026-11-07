import type { Category, Recurrence, Transaction } from '@/db/schema'
import { showToast } from '@/app/toast'
import { categoryName } from '@/db/names'
import { deleteTransaction, restoreTransaction } from '@/db/repositories/transactions'
import { formatDate, today } from '@/domain/dates'
import { signedCents } from '@/domain/days'
import { formatAmount } from '@/domain/money'
import { describeEveryInline } from '@/features/recurrences/describe'
import { i18n } from '@/i18n'
import { intlLocale } from '@/i18n/locale'

type NoticeKind = 'saved' | 'deleted' | 'duplicated'

/** What a transaction is about: its category, or the two accounts of a transfer. */
type NoticeSubject = Category | string | undefined

function subjectName(subject: NoticeSubject): string {
  if (typeof subject === 'string')
    return subject
  return subject
    ? categoryName(subject)
    : ''
}

/**
 * «Salvato: −12,40 € · Spesa», and the same for deleted and duplicated transactions. A transfer
 * has no sign: «Salvato: 100,00 € · Banca → Contanti».
 */
export function transactionNotice(kind: NoticeKind, transaction: Pick<Transaction, 'kind' | 'amountCents'>, subject?: NoticeSubject): string {
  return i18n.global.t(`toast.${kind}`, {
    amount: amountText(transaction),
    category: subjectName(subject),
  })
}

function amountText(transaction: Pick<Transaction, 'kind' | 'amountCents'>): string {
  return transaction.kind === 'transfer'
    ? formatAmount(transaction.amountCents, intlLocale(), { currency: true })
    : formatAmount(signedCents(transaction), intlLocale(), { sign: 'always', currency: true })
}

/** «Salvato: … · Spesa» and a sentence after it, with the period between them. */
function addSentence(message: string, sentence: string): string {
  return `${message}${message.endsWith('.')
    ? ''
    : '.'} ${sentence}`
}

/** A notice with a budget warning stays longer: it has more to read. */
const WARNING_DURATION = 8000

function withWarning(message: string, warning?: string) {
  return warning
    ? {
        message: addSentence(message, warning),
        duration: WARNING_DURATION,
      }
    : { message }
}

/** After a save; `warning` is a budget that went past 80% or over it (features/budgets/warnings.ts). */
export function showSaved(transaction: Pick<Transaction, 'kind' | 'amountCents'>, category?: NoticeSubject, warning?: string) {
  showToast(withWarning(transactionNotice('saved', transaction, category), warning))
}

/**
 * After saving a series (docs/specs/released/ricorrenze.md): «Salvato: −750,00 € · Casa. Si ripete ogni
 * mese.», or «Programmato: −750,00 € · Casa, dal 1 dicembre, ogni mese.» when it starts later.
 */
export function showSeriesSaved(
  transaction: Pick<Transaction, 'kind' | 'amountCents'>,
  subject: NoticeSubject,
  schedule: Pick<Recurrence, 'freq' | 'interval' | 'startDate'>,
  warning?: string,
) {
  const every = describeEveryInline(schedule)
  const current = today()
  const message = schedule.startDate > current
    ? i18n.global.t('recurrences.scheduled', {
        amount: amountText(transaction),
        category: subjectName(subject),
        date: formatDate(schedule.startDate, intlLocale(), {
          day: 'numeric',
          month: 'long',
          ...(schedule.startDate.slice(0, 4) === current.slice(0, 4)
            ? {}
            : { year: 'numeric' }),
        }),
        every,
      })
    : addSentence(transactionNotice('saved', transaction, subject), i18n.global.t('recurrences.repeats', { every }))
  showToast(withWarning(message, warning))
}

/** After a deletion: «Annulla» restores the transaction. */
export function showDeleted(transaction: Transaction, category?: NoticeSubject) {
  showToast({
    message: transactionNotice('deleted', transaction, category),
    action: {
      label: i18n.global.t('common.undo'),
      run: () => restoreTransaction(transaction.id),
    },
  })
}

/** After a duplication: «Annulla» deletes the copy. */
export function showDuplicated(copy: Transaction, category?: NoticeSubject, warning?: string) {
  showToast({
    ...withWarning(transactionNotice('duplicated', copy, category), warning),
    action: {
      label: i18n.global.t('common.undo'),
      run: () => deleteTransaction(copy.id),
    },
  })
}
