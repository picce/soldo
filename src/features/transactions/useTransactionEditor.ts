import type { Category, Transaction } from '@/db/schema'
import type { CalculatorKey, CalculatorState } from '@/domain/calculator'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from '@/app/toast'
import { getDefaultAccount } from '@/db/repositories/accounts'
import { getCategory, listCategories } from '@/db/repositories/categories'
import {
  addTransaction,
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from '@/db/repositories/transactions'
import { useLiveQuery } from '@/db/useLiveQuery'
import {
  calculatorFromCents,
  emptyCalculator,
  evaluate,
  isEmptyCalculator,
  isValidResult,
  pressKey,
} from '@/domain/calculator'
import { today } from '@/domain/dates'
import { showDeleted, showDuplicated, showSaved } from './notices'

export type EditorKind = 'expense' | 'income'

export type EditorTarget
  = | { mode: 'new', kind: EditorKind }
    | { mode: 'edit', id: string }

/** Why the screen cannot save yet, shown above the amount. */
export type EditorHint = 'enterAmount' | 'invalidAmount' | 'chooseCategory'

export interface EditorOptions {
  /** Called once the transaction is saved, duplicated or deleted: the screen closes. */
  onDone: () => void
  /** Called in edit mode when the transaction does not exist (or was deleted). */
  onNotFound: () => void
}

/**
 * State and actions of the quick-add and edit screen (docs/specs/released/aggiunta-rapida.md).
 * A new transaction is saved by tapping a category; an existing one with «Salva».
 */
export function useTransactionEditor(target: EditorTarget, options: EditorOptions) {
  const { t } = useI18n()

  const isEdit = target.mode === 'edit'
  const kind = ref<EditorKind>(target.mode === 'new'
    ? target.kind
    : 'expense')
  const calculator = shallowRef<CalculatorState>(emptyCalculator())
  const date = ref(today())
  const note = ref('')
  const categoryId = ref<string | null>(null)
  const original = shallowRef<Transaction>()
  /** False while an existing transaction is loading. */
  const ready = ref(!isEdit)
  const hint = ref<EditorHint | null>(null)
  /** Grows at every refused save: the amount shakes again. */
  const shakeCount = ref(0)
  let busy = false

  const amountCents = computed(() => evaluate(calculator.value))

  // Archived categories are hidden, except the one of the transaction being edited.
  const { data: categoryRows } = useLiveQuery(
    () => listCategories({ kind: kind.value, includeArchived: true }),
    [kind],
  )
  const categories = computed(() => (categoryRows.value ?? [])
    .filter(category => !category.archived || category.id === original.value?.categoryId))

  /** The selected category, when it belongs to the current kind. */
  const selectedId = computed(() => categories.value.some(category => category.id === categoryId.value)
    ? categoryId.value
    : null)

  if (target.mode === 'edit') {
    void getTransaction(target.id).then((transaction) => {
      if (!transaction || transaction.kind === 'transfer') {
        options.onNotFound()
        return
      }
      original.value = transaction
      kind.value = transaction.kind
      calculator.value = calculatorFromCents(transaction.amountCents)
      date.value = transaction.date
      note.value = transaction.note
      categoryId.value = transaction.categoryId
      ready.value = true
    })
  }

  function press(key: CalculatorKey) {
    calculator.value = pressKey(calculator.value, key)
    hint.value = null
  }

  function refuse(reason: EditorHint) {
    hint.value = reason
    shakeCount.value++
    if ('vibrate' in navigator)
      navigator.vibrate(30)
  }

  /** The amount, or null after showing why it cannot be saved. */
  function validAmount(): number | null {
    if (isValidResult(amountCents.value))
      return amountCents.value
    refuse(isEmptyCalculator(calculator.value)
      ? 'enterAmount'
      : 'invalidAmount')
    return null
  }

  /** Runs one write at a time (a double tap must not save twice) and reports failures. */
  async function run(action: () => Promise<void>) {
    if (busy)
      return
    busy = true
    try {
      await action()
    }
    catch (error) {
      console.error(error)
      showToast({
        message: t('common.saveError'),
      })
    }
    finally {
      busy = false
    }
  }

  function selectCategory(category: Category) {
    hint.value = null
    if (isEdit) {
      categoryId.value = category.id
      return
    }
    const amount = validAmount()
    if (amount === null)
      return
    void run(async () => {
      const account = await getDefaultAccount()
      if (!account)
        throw new Error('No account to save the transaction to')
      const saved = await addTransaction({
        kind: kind.value,
        amountCents: amount,
        date: date.value,
        accountId: account.id,
        categoryId: category.id,
        note: note.value,
      })
      showSaved(saved, category)
      options.onDone()
    })
  }

  /** Fields of the edited transaction as shown on screen, or null if they cannot be saved. */
  function editedFields() {
    const amount = validAmount()
    if (amount === null)
      return null
    const category = categories.value.find(item => item.id === selectedId.value)
    if (!category) {
      refuse('chooseCategory')
      return null
    }
    return {
      category,
      fields: {
        kind: kind.value,
        amountCents: amount,
        date: date.value,
        categoryId: category.id,
        note: note.value,
      },
    }
  }

  function save() {
    const edited = editedFields()
    const transaction = original.value
    if (!edited || !transaction)
      return
    void run(async () => {
      await updateTransaction(transaction.id, edited.fields)
      showSaved(edited.fields, edited.category)
      options.onDone()
    })
  }

  /** Copy of what is on screen, dated today; the original stays as it was. */
  function duplicate() {
    const edited = editedFields()
    const transaction = original.value
    if (!edited || !transaction)
      return
    void run(async () => {
      const copy = await addTransaction({
        ...edited.fields,
        date: today(),
        accountId: transaction.accountId,
      })
      showDuplicated(copy, edited.category)
      options.onDone()
    })
  }

  function remove() {
    const transaction = original.value
    if (!transaction)
      return
    void run(async () => {
      await deleteTransaction(transaction.id)
      const category = transaction.categoryId
        ? await getCategory(transaction.categoryId)
        : undefined
      showDeleted(transaction, category)
      options.onDone()
    })
  }

  return {
    isEdit,
    ready,
    kind,
    calculator,
    amountCents,
    date,
    note,
    categories,
    selectedId,
    hint,
    shakeCount,
    press,
    selectCategory,
    save,
    duplicate,
    remove,
  }
}
