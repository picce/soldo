import type { Category, Transaction } from '@/db/schema'
import { showToast } from '@/app/toast'
import { categoryName } from '@/db/names'
import { deleteTransaction, restoreTransaction } from '@/db/repositories/transactions'
import { signedCents } from '@/domain/days'
import { formatAmount } from '@/domain/money'
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
  const amount = transaction.kind === 'transfer'
    ? formatAmount(transaction.amountCents, intlLocale(), { currency: true })
    : formatAmount(signedCents(transaction), intlLocale(), { sign: 'always', currency: true })
  return i18n.global.t(`toast.${kind}`, {
    amount,
    category: subjectName(subject),
  })
}

export function showSaved(transaction: Pick<Transaction, 'kind' | 'amountCents'>, category?: NoticeSubject) {
  showToast({
    message: transactionNotice('saved', transaction, category),
  })
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
export function showDuplicated(copy: Transaction, category?: NoticeSubject) {
  showToast({
    message: transactionNotice('duplicated', copy, category),
    action: {
      label: i18n.global.t('common.undo'),
      run: () => deleteTransaction(copy.id),
    },
  })
}
