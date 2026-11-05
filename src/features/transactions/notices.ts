import type { Category, Transaction } from '@/db/schema'
import { showToast } from '@/app/toast'
import { categoryName } from '@/db/names'
import { deleteTransaction, restoreTransaction } from '@/db/repositories/transactions'
import { signedCents } from '@/domain/days'
import { formatAmount } from '@/domain/money'
import { i18n } from '@/i18n'
import { intlLocale } from '@/i18n/locale'

type NoticeKind = 'saved' | 'deleted' | 'duplicated'

/** «Salvato: −12,40 € · Spesa», and the same for deleted and duplicated transactions. */
export function transactionNotice(kind: NoticeKind, transaction: Pick<Transaction, 'kind' | 'amountCents'>, category?: Category): string {
  return i18n.global.t(`toast.${kind}`, {
    amount: formatAmount(signedCents(transaction), intlLocale(), { sign: 'always', currency: true }),
    category: category
      ? categoryName(category)
      : '',
  })
}

export function showSaved(transaction: Pick<Transaction, 'kind' | 'amountCents'>, category?: Category) {
  showToast({
    message: transactionNotice('saved', transaction, category),
  })
}

/** After a deletion: «Annulla» restores the transaction. */
export function showDeleted(transaction: Transaction, category?: Category) {
  showToast({
    message: transactionNotice('deleted', transaction, category),
    action: {
      label: i18n.global.t('common.undo'),
      run: () => restoreTransaction(transaction.id),
    },
  })
}

/** After a duplication: «Annulla» deletes the copy. */
export function showDuplicated(copy: Transaction, category?: Category) {
  showToast({
    message: transactionNotice('duplicated', copy, category),
    action: {
      label: i18n.global.t('common.undo'),
      run: () => deleteTransaction(copy.id),
    },
  })
}
